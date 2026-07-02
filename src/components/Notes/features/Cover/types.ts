export interface NoteCoverData {
  url: string | null;
  positionX: number;
  positionY: number;
  height?: number;
  scale: number;
}

export interface NoteCoverController {
  cover: NoteCoverData;
  notesRootPath: string;
  currentNotePath?: string;
  isPickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  updateCover: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  openCoverPicker: () => void;
}
