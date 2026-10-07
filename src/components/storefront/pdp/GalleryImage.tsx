import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<"img">, "onLoad"> & {
  onReady: (image: HTMLImageElement) => void;
};

/** Cached photos are checked after commit, never from a changing callback ref. */
export default function GalleryImage({ onReady, src, ...props }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const image = imageRef.current;
    if (src && image?.complete && image.naturalWidth > 0) {
      readyRef.current(image);
    }
  }, [src]);

  return <img {...props} src={src} ref={imageRef} onLoad={(event) => readyRef.current(event.currentTarget)} />;
}