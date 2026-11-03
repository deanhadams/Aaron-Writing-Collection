import type { CSSProperties } from "react";

type Blob = CSSProperties & {
  "--blob": string;
  "--drift-x": string;
  "--drift-y": string;
};

const BLOBS: Blob[] = [
  { top: "-35vmax", left: "-20vmax", "--blob": "rgb(37 99 255 / 0.2)", "--drift-x": "10vmax", "--drift-y": "6vmax" },
  { top: "-30vmax", right: "-25vmax", "--blob": "rgb(124 92 255 / 0.2)", "--drift-x": "-9vmax", "--drift-y": "8vmax", animationDelay: "-14s" },
  { bottom: "-40vmax", left: "5vmax", "--blob": "rgb(0 217 255 / 0.2)", "--drift-x": "8vmax", "--drift-y": "-7vmax", animationDelay: "-28s" },
  { bottom: "-45vmax", right: "-15vmax", "--blob": "rgb(255 79 163 / 0.1)", "--drift-x": "-7vmax", "--drift-y": "-6vmax", animationDelay: "-40s" },
];

export function MeshBackground() {
  return (
    <div aria-hidden className="mesh">
      {BLOBS.map((style, index) => (
        <div key={index} className="mesh-blob" style={style} />
      ))}
    </div>
  );
}
