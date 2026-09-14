import { useState } from 'react';
import { copyText, downloadText } from './download.js';

type Props = {
  name: string;
  code: string;
  ariaLabel: string;
  /** Render the file name as a heading (the spec) rather than a plain label (the shell command). */
  nameAsHeading?: boolean;
  numbered?: boolean;
  download?: { fileName: string; type: string };
};

export function CodeBlock({
  name,
  code,
  ariaLabel,
  nameAsHeading = false,
  numbered = false,
  download,
}: Props) {
  const [copied, setCopied] = useState(false);
  const lines = code.replace(/\n$/, '').split('\n');

  return (
    <div className="codeblock">
      <div className="head">
        {nameAsHeading ? <h2>{name}</h2> : <span className="name">{name}</span>}
        <div className="row-8">
          <button
            type="button"
            className="btn btn-xs"
            onClick={async () => {
              setCopied(await copyText(code));
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {download && (
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => downloadText(download.fileName, code, download.type)}
            >
              Download
            </button>
          )}
        </div>
      </div>
      <pre className={numbered ? 'numbered' : undefined} tabIndex={0} aria-label={ariaLabel}>
        {numbered ? (
          <code>
            {lines.map((line, i) => (
              <span className="ln" key={i}>
                <span className="n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="t">{line.length > 0 ? line : ' '}</span>
              </span>
            ))}
          </code>
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}
