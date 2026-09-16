import { useEffect, useReducer, useRef } from 'react';
import type { Brief } from './domain/brief.js';
import type { RunFailure } from './domain/run-failures.js';
import type { DispatchConfig } from './github/dispatch.js';
import type { Step } from './state.js';
import { validateBrief } from './domain/brief.js';
import { failuresToBugReport } from './domain/bug-report.js';
import { failuresWith } from './domain/run-failures.js';
import { findTarget } from './domain/targets.js';
import { downloadText } from './ui/download.js';
import { SAMPLE_PLAN } from './fixtures/sample-plan.js';
import { SAMPLE_SPEC } from './fixtures/sample-spec.js';
import { collectRunFailures, dispatchSpecRun, GitHubError, waitForRun } from './github/dispatch.js';
import { clearSession, loadSession, saveSession } from './persistence.js';
import { initialState, reducer, STEPS } from './state.js';
import { BriefForm } from './ui/BriefForm.js';
import { Alert } from './ui/Feedback.js';
import { KeyPanel } from './ui/KeyPanel.js';
import { PlanView } from './ui/PlanView.js';
import { RunPanel } from './ui/RunPanel.js';
import { SpecView } from './ui/SpecView.js';
import { StepHeader } from './ui/StepHeader.js';
import { Stepper } from './ui/Stepper.js';
import { TopBar } from './ui/TopBar.js';

// The Anthropic SDK and the planner that depends on it are only downloaded when someone
// actually generates; visitors exploring the sample plan never pay for them.
const loadLlm = async () => {
  const [planner, client] = await Promise.all([
    import('./llm/planner.js'),
    import('./llm/anthropic-client.js'),
  ]);
  return { ...planner, ...client };
};
type Llm = Awaited<ReturnType<typeof loadLlm>>;

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => ({ ...init, ...loadSession() }));

  // Persist artefacts between reloads; skipped mid-generation so streaming does not thrash storage.
  useEffect(() => {
    if (!state.busy) saveSession(state);
  }, [state]);

  const onReset = () => {
    abortRef.current?.abort();
    clearSession();
    dispatch({ type: 'reset' });
  };
  const abortRef = useRef<AbortController | null>(null);
  const target = findTarget(state.brief.targetId);
  const hasKey = state.apiKey.trim().length > 0;
  const stepIndex = STEPS.findIndex((s) => s.id === state.step);
  const busyFor = (kind: 'plan' | 'spec') => (state.busy?.kind === kind ? state.busy : null);

  /** Runs one generation with cancel support; maps every failure to a user-facing message. */
  const generate = async (kind: 'plan' | 'spec', work: (llm: Llm, signal: AbortSignal) => Promise<void>) => {
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: 'start', kind });
    try {
      const llm = await loadLlm();
      await work(llm, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        dispatch({ type: 'cancel' });
        return;
      }
      const { GenerationError, describeApiError } = await loadLlm();
      dispatch({
        type: 'fail',
        message: error instanceof GenerationError ? error.message : describeApiError(error),
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const onCancel = () => abortRef.current?.abort();

  const onGeneratePlan = () => {
    const problems = validateBrief(state.brief);
    if (problems.length > 0) return dispatch({ type: 'fail', message: problems.join(' ') });
    if (!hasKey) return dispatch({ type: 'fail', message: 'Add your API key, or load the sample plan.' });

    void generate('plan', async (llm, signal) => {
      const plan = await llm.generatePlan(llm.createStreamFactory(state.apiKey), state.brief, target, {
        model: state.model,
        signal,
        onProgress: (characters) => dispatch({ type: 'progress', characters }),
      });
      dispatch({ type: 'planReady', plan, source: 'generated' });
    });
  };

  /** Regenerating from the Specs step carries lint feedback; from the Run step it also
   *  carries the failures a reviewer marked as test defects. */
  const onGenerateSpec = (runFailures: RunFailure[] = []) => {
    if (!state.plan) return;
    const plan = state.plan;
    const scenarios = plan.scenarios.filter((s) => state.selected.includes(s.id));
    const feedback = state.lint?.findings.filter((f) => f.severity === 'error');

    void generate('spec', async (llm, signal) => {
      const spec = await llm.generateSpec(llm.createStreamFactory(state.apiKey), plan, scenarios, target, {
        model: state.model,
        signal,
        feedback,
        runFailures,
        onProgress: (characters) => dispatch({ type: 'progress', characters }),
      });
      dispatch({ type: 'specReady', spec });
    });
  };

  const onDownloadBugReport = () => {
    if (!state.plan) return;
    const failures = failuresWith(state.run.failures, state.run.triage, 'app');
    downloadText(
      'defects.md',
      failuresToBugReport(state.plan, target, failures, state.run.run?.html_url),
      'text/markdown;charset=utf-8',
    );
  };

  const onDispatch = async (config: DispatchConfig) => {
    if (!state.spec || !target) return;
    const since = new Date();
    dispatch({ type: 'run', run: { status: 'dispatching', run: null, message: null } });
    try {
      await dispatchSpecRun(config, {
        target: target.id,
        specFileName: state.spec.fileName,
        specCode: state.spec.code,
      });
      dispatch({
        type: 'run',
        run: { status: 'waiting', run: null, message: 'waiting for the run to appear' },
      });
      const run = await waitForRun(config, since, {
        onUpdate: (update) =>
          dispatch({
            type: 'run',
            run: {
              status: 'waiting',
              run: update,
              message: update ? `run #${update.id} is ${update.status}` : null,
            },
          }),
      });
      const succeeded = run.conclusion === 'success';
      dispatch({ type: 'run', run: { status: succeeded ? 'completed' : 'failed', run, message: null } });
      if (succeeded) return;

      // A failed run is only useful if you can see which test failed and why.
      try {
        const failures = await collectRunFailures(config, run.id);
        dispatch({ type: 'run', run: { status: 'failed', run, message: null, failures } });
      } catch (error) {
        const message = error instanceof GitHubError ? error.message : (error as Error).message;
        dispatch({ type: 'run', run: { status: 'failed', run, message } });
      }
    } catch (error) {
      const message = error instanceof GitHubError ? error.message : (error as Error).message;
      dispatch({ type: 'run', run: { status: 'failed', run: null, message } });
    }
  };

  return (
    <>
      <TopBar stepIndex={stepIndex} stepCount={STEPS.length} onReset={onReset} />
      <div className="layout">
        <Stepper state={state} onSelect={(step: Step) => dispatch({ type: 'setStep', step })} />
        <main className="main">
          <StepHeader title={STEPS[stepIndex].label} index={stepIndex} count={STEPS.length} />

          {state.error && <Alert onDismiss={() => dispatch({ type: 'dismissError' })}>{state.error}</Alert>}

          {state.step === 'brief' && (
            <>
              <KeyPanel
                apiKey={state.apiKey}
                model={state.model}
                onApiKeyChange={(apiKey) => dispatch({ type: 'setApiKey', apiKey })}
                onModelChange={(model) => dispatch({ type: 'setModel', model })}
              />
              <BriefForm
                brief={state.brief}
                hasKey={hasKey}
                busy={busyFor('plan')}
                onChange={(brief: Brief) => dispatch({ type: 'setBrief', brief })}
                onGenerate={onGeneratePlan}
                onCancel={onCancel}
                onLoadSample={() => {
                  dispatch({ type: 'setBrief', brief: { ...state.brief, targetId: 'lab' } });
                  dispatch({ type: 'planReady', plan: SAMPLE_PLAN, source: 'sample' });
                }}
              />
            </>
          )}

          {state.step === 'plan' && state.plan && state.planSource && (
            <PlanView
              plan={state.plan}
              source={state.planSource}
              selected={state.selected}
              hasKey={hasKey}
              busy={busyFor('spec')}
              onToggle={(id) => dispatch({ type: 'toggleScenario', id })}
              onGenerateSpec={onGenerateSpec}
              onCancel={onCancel}
              onLoadSampleSpec={() => dispatch({ type: 'specReady', spec: SAMPLE_SPEC })}
            />
          )}

          {state.step === 'specs' && state.spec && state.lint && (
            <SpecView
              spec={state.spec}
              lint={state.lint}
              hasKey={hasKey}
              busy={busyFor('spec')}
              onRegenerate={() => onGenerateSpec()}
              onCancel={onCancel}
              onContinue={() => dispatch({ type: 'setStep', step: 'run' })}
            />
          )}

          {state.step === 'run' && state.spec && (
            <RunPanel
              spec={state.spec}
              target={target}
              run={state.run}
              generating={state.busy !== null}
              hasKey={hasKey}
              onDispatch={onDispatch}
              onTriage={(id, verdict) => dispatch({ type: 'triage', id, verdict })}
              onRegenerate={() => onGenerateSpec(failuresWith(state.run.failures, state.run.triage, 'test'))}
              onDownloadBugReport={onDownloadBugReport}
            />
          )}
        </main>
      </div>
    </>
  );
}
