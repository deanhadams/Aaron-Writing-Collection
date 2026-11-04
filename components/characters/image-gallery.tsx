"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { useModal } from "@/components/ui/use-modal";
import {
  attachImage,
  removeImage,
  saveImageCaption,
  saveImageOrder,
} from "@/lib/characters/client";
import { UploadZone } from "./upload-zone";

export type GalleryImage = { id: string; url: string | null; caption: string | null };

function Thumb({
  image,
  position,
  onOpen,
  onDelete,
}: {
  image: GalleryImage;
  position: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id });
  const label = image.caption || `Image ${position}`;

  return (
    <li
      ref={setNodeRef}
      className="image-thumb"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition } as CSSProperties}
    >
      <button
        type="button"
        aria-label={`Open ${label}`}
        className="image-thumb-open"
        style={image.url ? { backgroundImage: `url(${JSON.stringify(image.url)})` } : undefined}
        onClick={onOpen}
      />
      {image.caption && <p className="mt-1 truncate text-xs text-muted">{image.caption}</p>}
      <div className="image-thumb-tools">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="image-tool cursor-grab"
          {...attributes}
          {...listeners}
          aria-label={`Move ${label}`}
        >
          ⠿
        </button>
        <button type="button" className="image-tool" aria-label={`Delete ${label}`} onClick={onDelete}>
          ×
        </button>
      </div>
    </li>
  );
}

function Lightbox({
  images,
  index,
  onMove,
  onCaption,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  onMove: (step: 1 | -1) => void;
  onCaption: (caption: string) => void;
  onClose: () => void;
}) {
  const dialog = useModal();
  const image = images[index];

  return (
    <dialog
      ref={dialog}
      aria-label="Image viewer"
      className="lightbox"
      onClose={onClose}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).tagName === "INPUT") return;
        if (event.key === "ArrowRight") onMove(1);
        if (event.key === "ArrowLeft") onMove(-1);
      }}
    >
      <div
        role="img"
        aria-label={image.caption ?? `Image ${index + 1}`}
        className="lightbox-image"
        style={image.url ? { backgroundImage: `url(${JSON.stringify(image.url)})` } : undefined}
      />
      <div className="lightbox-bar">
        <button type="button" className="btn-ghost text-sm" aria-label="Previous image" onClick={() => onMove(-1)}>
          ←
        </button>
        <input
          key={image.id}
          defaultValue={image.caption ?? ""}
          placeholder="Add a caption"
          aria-label="Caption"
          className="field min-w-0 flex-1 text-sm"
          onBlur={(event) => {
            if (event.target.value !== (image.caption ?? "")) onCaption(event.target.value);
          }}
        />
        <button type="button" className="btn-ghost text-sm" aria-label="Next image" onClick={() => onMove(1)}>
          →
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}

export function ImageGallery({ characterId, images: initial }: { characterId: string; images: GalleryImage[] }) {
  const router = useRouter();
  const [images, setImages] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // New server data, such as after an upload, replaces the local order.
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setImages(initial);
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const ids = images.map(({ id }) => id);
    const next = arrayMove(images, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setImages(next);
    void saveImageOrder(characterId, next.map(({ id }) => id));
  };

  const handleDelete = (image: GalleryImage) => {
    if (!window.confirm(`Delete ${image.caption || "this image"}?`)) return;
    setImages((list) => list.filter(({ id }) => id !== image.id));
    void removeImage(characterId, image.id);
  };

  const handleCaption = (image: GalleryImage, caption: string) => {
    setImages((list) => list.map((item) => (item.id === image.id ? { ...item, caption: caption.trim() || null } : item)));
    void saveImageCaption(characterId, image.id, caption);
  };

  return (
    <>
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map(({ id }) => id)} strategy={rectSortingStrategy}>
            <ul className="image-grid">
              {images.map((image, index) => (
                <Thumb
                  key={image.id}
                  image={image}
                  position={index + 1}
                  onOpen={() => setOpenIndex(index)}
                  onDelete={() => handleDelete(image)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <div className={images.length ? "mt-4" : ""}>
        <UploadZone
          characterId={characterId}
          kind="image"
          label="Add an image"
          onUploaded={async (key) => {
            await attachImage(characterId, key, null);
            router.refresh();
          }}
        />
      </div>

      {openIndex !== null && images[openIndex] && (
        <Lightbox
          images={images}
          index={openIndex}
          onMove={(step) => setOpenIndex((openIndex + step + images.length) % images.length)}
          onCaption={(caption) => handleCaption(images[openIndex], caption)}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
