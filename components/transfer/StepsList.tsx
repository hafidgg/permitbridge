export function StepsList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {index + 1}
          </span>
          <p className="pt-1 text-sm leading-relaxed">{step}</p>
        </li>
      ))}
    </ol>
  );
}
