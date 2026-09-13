import { useReducer } from 'react';
import type { Brief } from './domain/brief.js';
import type { DispatchConfig } from './github/dispatch.js';
import type { Step } from './state.js';
import { validateBrief } from './domain/brief.js';
import { findTarget } from './domain/targets.js';
import { SAMPLE_PLAN } from './fixtures/sample-plan.js';
import { SAMPLE_SPEC } from './fixtures/sample-spec.js';
import { dispatchSpecRun, GitHubError, waitForRun } from './github/dispatch.js';
import { initialState, reducer } from './state.js';
import { BriefForm } from './ui/BriefForm.js';
import { Header } from './ui/Header.js';
import { KeyPanel } from './ui/KeyPanel.js';
import { Notice, Progress } from './ui/Notice.js';
import { PlanView } from './ui/PlanView.js';
import { RunPanel } from './ui/RunPanel.js';
import { SpecView } from './ui/SpecView.js';
import { Stepper } from './ui/Stepper.js';

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const target = findTarget(state.brief.targetId);
  const hasKey = state.apiKey.trim().length > 0;

  // The Anthropic SDK (and the planner that depends on it) is only downloaded when someone
  // actually generates; visitors exploring the sample plan never pay for it.
  const loadLlm = async () => {
    const [planner, client] = await Promise.all([
      import('./llm/planner.js'),
      import('./llm/anthropic-client.js'),
    ]);
    return { ...planner, ...client };
  };

  const fail = async (error: unknown) => {
    const { GenerationError, describeApiError } = await loadLlm();
    const message = error instanceof GenerationError ? error.message : describeApiError(error);
    dispatch({ type: 'fail', message });
  };

  const onGeneratePlan = async () => {
    const problems = validateBrief(state.brief);
    if (problems.length > 0) return dispatch({ type: 'fail', message: problems.join(' ') });
    if (!hasKey) return dispatch({ type: 'fail', message: 'Add your API key, or load the sample plan.' });

    dispatch({ type: 'start', kind: 'plan' });
    try {
      const { createStreamFactory, generatePlan } = await loadLlm();
      const plan = await generatePlan(createStreamFactory(state.apiKey), state.brief, target, {
        model: state.model,
        onProgress: (characters) => dispatch({ type: 'progress', characters }),
      });
      dispatch({ type: 'planReady', plan, source: 'generated' });
    } catch (error) {
      await fail(error);
    }
  };

  const onGenerateSpec = async () => {
    if (!state.plan) return;
    const scenarios = state.plan.scenarios.filter((s) => state.selected.includes(s.id));
    dispatch({ type: 'start', kind: 'spec' });
    try {
      const { createStreamFactory, generateSpec } = await loadLlm();
      const spec = await generateSpec(createStreamFactory(state.apiKey), state.plan, scenarios, target, {
        model: state.model,
        feedback: state.lint?.findings.filter((f) => f.severity === 'error'),
        onProgress: (characters) => dispatch({ type: 'progress', characters }),
      });
      dispatch({ type: 'specReady', spec });
    } catch (error) {
      await fail(error);
    }
  };

  const onDispatch = async (config: DispatchConfig) => {
    if (!state.spec || !target) return;
    const since = new Date();
    dispatch({
      type: 'run',
      run: { status: 'dispatching', run: null, message: 'Sending workflow_dispatch…' },
    });
    try {
      await dispatchSpecRun(config, {
        target: target.id,
        specFileName: state.spec.fileName,
        specCode: state.spec.code,
      });
      dispatch({
        type: 'run',
        run: { status: 'waiting', run: null, message: 'Waiting for the run to start…' },
      });
      const run = await waitForRun(config, since, {
        onUpdate: (update) =>
          dispatch({
            type: 'run',
            run: {
              status: 'waiting',
              run: update,
              message: update ? `Run is ${update.status}` : 'Waiting for the run to appear…',
            },
          }),
      });
      dispatch({
        type: 'run',
        run: { status: run.conclusion === 'success' ? 'completed' : 'failed', run, message: null },
      });
    } catch (error) {
      const message = error instanceof GitHubError ? error.message : (error as Error).message;
      dispatch({ type: 'run', run: { status: 'failed', run: null, message } });
    }
  };

  return (
    <div className="shell">
      <Header />
      <div className="workspace">
        <Stepper state={state} onSelect={(step: Step) => dispatch({ type: 'setStep', step })} />
        <main className="stack">
          {state.error && (
            <Notice kind="error" onDismiss={() => dispatch({ type: 'dismissError' })}>
              {state.error}
            </Notice>
          )}
          {state.busy && (
            <Progress
              label={state.busy.kind === 'plan' ? 'Drafting the test plan' : 'Writing the Playwright spec'}
              characters={state.busy.characters}
            />
          )}

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
                busy={state.busy !== null}
                onChange={(brief: Brief) => dispatch({ type: 'setBrief', brief })}
                onGenerate={onGeneratePlan}
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
              busy={state.busy !== null}
              onToggle={(id) => dispatch({ type: 'toggleScenario', id })}
              onGenerateSpec={onGenerateSpec}
              onLoadSampleSpec={() => dispatch({ type: 'specReady', spec: SAMPLE_SPEC })}
            />
          )}

          {state.step === 'specs' && state.spec && state.lint && (
            <SpecView
              spec={state.spec}
              lint={state.lint}
              hasKey={hasKey}
              busy={state.busy !== null}
              onRegenerate={onGenerateSpec}
              onContinue={() => dispatch({ type: 'setStep', step: 'run' })}
            />
          )}

          {state.step === 'run' && state.spec && (
            <RunPanel spec={state.spec} target={target} run={state.run} onDispatch={onDispatch} />
          )}
        </main>
      </div>
      <footer className="footer">
        <span>
          Built by <a href="https://github.com/cozgur">Özgür Çetintaş</a>. MIT licensed.
        </span>
        <span>Static site · no backend · your keys stay in your browser.</span>
      </footer>
    </div>
  );
}
