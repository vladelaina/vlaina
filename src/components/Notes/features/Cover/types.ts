export interface NoteCoverData {
  url: string | null;
  positionX: number;
  positionY: number;
  height?: number;
  scale: number;
}

export interface NoteCoverController {
  cover: NoteCoverData;
  vaultPath: string;
  isPickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  updateCover: (url: string | null, positionX: number, positionY: number, height?: number, scale?: number) => void;
  addRandomCoverAndOpenPicker: () => void;
}
