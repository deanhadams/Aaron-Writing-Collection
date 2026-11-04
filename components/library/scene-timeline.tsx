import { SceneCard, type SceneCardData } from "./scene-card";

export function SceneTimeline({ scenes }: { scenes: SceneCardData[] }) {
  return (
    <ol className="timeline space-y-5">
      {scenes.map((scene, index) => (
        <SceneCard
          key={scene.id}
          scene={scene}
          index={index}
          // Prologues and outros are not numbered scenes in the script.
          number={
            scene.kind === "scene"
              ? scenes.slice(0, index + 1).filter((s) => s.kind === "scene").length
              : null
          }
        />
      ))}
    </ol>
  );
}
