import useImage from "use-image";
import { Image } from "react-konva";

function MapImage({ url }: { url: string }) {
  const [image] = useImage(url);
  return <Image image={image} />;
}

export { MapImage };
