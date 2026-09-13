// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { EMPTY_BRIEF } from '../../src/domain/brief.js';
import { BriefForm } from '../../src/ui/BriefForm.js';

describe('BriefForm', () => {
  test('cannot generate without a key but can always load the sample', async () => {
    const onLoadSample = vi.fn();
    render(
      <BriefForm
        brief={EMPTY_BRIEF}
        hasKey={false}
        busy={false}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        onLoadSample={onLoadSample}
      />,
    );

    expect(screen.getByRole('button', { name: 'Generate plan' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Load sample plan' }));
    expect(onLoadSample).toHaveBeenCalledTimes(1);
  });

  test('toggling a risk focus reports the updated brief', async () => {
    const onChange = vi.fn();
    render(
      <BriefForm
        brief={EMPTY_BRIEF}
        hasKey
        busy={false}
        onChange={onChange}
        onGenerate={vi.fn()}
        onLoadSample={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'Performance' }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...EMPTY_BRIEF,
      focus: [...EMPTY_BRIEF.focus, 'performance'],
    });
  });

  test('submitting the form triggers generation', async () => {
    const onGenerate = vi.fn();
    render(
      <BriefForm
        brief={EMPTY_BRIEF}
        hasKey
        busy={false}
        onChange={vi.fn()}
        onGenerate={onGenerate}
        onLoadSample={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Generate plan' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
