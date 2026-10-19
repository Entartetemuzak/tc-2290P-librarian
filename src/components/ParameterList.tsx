import { describeParameters } from '../protocol/params';

/** A preset's parameters grouped by section, as stored in its TonePrint data. */
export default function ParameterList({ data }: { data: readonly number[] }) {
  const parameters = describeParameters(data);
  const sections = [...new Set(parameters.map((p) => p.section))];
  return (
    <div className="param-columns">
      {sections.map((section) => (
        <div className="param-group" key={section}>
          <h4>{section}</h4>
          <dl style={{ margin: 0 }}>
            {parameters.filter((p) => p.section === section).map((p) => (
              <div
                key={p.word}
                className={p.kind === 'hidden' ? 'param-row param-row--hidden' : 'param-row'}
              >
                <dt>{p.name}</dt>
                <dd>{p.display}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
