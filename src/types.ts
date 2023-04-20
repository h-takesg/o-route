export type Mode = "move" | "draw" | "erase";

export type DrawLine = {
  points: number[];
  timestamp: string;
  compositionMode: "source-over" | "destination-out";
}

export type Lines = {
  [key: string]: DrawLine;
}
