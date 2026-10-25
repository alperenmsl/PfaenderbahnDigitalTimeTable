import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  variant?: "blue" | "sun";
};

export default function PageHero({
  icon,
  title,
  subtitle,
  variant = "blue",
}: Props) {
  return (
    <div className={`page-hero ${variant}`}>
      <div className="ph-icon">{icon}</div>
      <div style={{ position: "relative", zIndex: 1 }}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
