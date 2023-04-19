export type Mode = "move" | "draw" | "erase";

export type DrawLine = {
  points: number[];
  id: string;
  compositionMode: "source-over" | "destination-out";
}
