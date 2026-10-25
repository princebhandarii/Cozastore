export default function ComingSoon({ title, phase }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {phase
          ? `This ships in ${phase} of the build.`
          : "This section ships in an upcoming build phase."}
      </p>
    </div>
  );
}
