"use client";

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(900px circle at 20% 0%, rgba(56, 189, 248, 0.35), transparent 55%), radial-gradient(800px circle at 90% 10%, rgba(168, 85, 247, 0.30), transparent 52%), radial-gradient(700px circle at 50% 100%, rgba(16, 185, 129, 0.18), transparent 60%)",
        }}
      />

      <div className="absolute left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-400/15 via-indigo-500/15 to-purple-500/15 blur-3xl animate-[clinIQ-float_7s_ease-in-out_infinite]" />
      <div className="absolute -left-28 top-80 h-[260px] w-[520px] rounded-full bg-gradient-to-b from-cyan-400/10 to-transparent blur-2xl animate-[clinIQ-float_9s_ease-in-out_infinite] [animation-delay:700ms]" />
      <div className="absolute -right-24 top-10 h-[300px] w-[560px] rounded-full bg-gradient-to-b from-fuchsia-400/10 to-transparent blur-2xl animate-[clinIQ-float_11s_ease-in-out_infinite] [animation-delay:300ms]" />

      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:60px_60px]" />
    </div>
  );
}

