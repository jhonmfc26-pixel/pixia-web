import { AlbumProvider } from "@/components/album/AlbumProvider";
import AlbumOpenAnimation from "@/components/album/AlbumOpenAnimation";

export default function CreateAlbumPage() {
  return (
    <AlbumProvider>
      <AlbumOpenAnimation />
    </AlbumProvider>
  );
}
