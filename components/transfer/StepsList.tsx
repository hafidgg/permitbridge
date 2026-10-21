// Steps prefixed "needs_review:" in the data are open questions the board's documents don't settle.
const OPEN_QUESTION_PREFIX = /^needs_review:\s*/;

export function StepsList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {index + 1}
          </span>
          <p className="pt-1 text-sm leading-relaxed">
            {OPEN_QUESTION_PREFIX.test(step) ? (
              <>
                <strong>Open question:</strong> {step.replace(OPEN_QUESTION_PREFIX, "")}
              </>
            ) : (
              step
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
