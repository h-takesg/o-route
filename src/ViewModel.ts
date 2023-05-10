import { Record } from "immutable";
import { Vector, clamp } from "./math";

const _ViewModelBase = Record({
  position: new Vector({ x: 0, y: 0 }),
  scale: 1,
  rotation: 0,
});

class ViewModel extends _ViewModelBase {
  move(movement: Vector) {
    return this.set("position", this.position.getAdd(movement));
  }

  scaleAt(center: Vector, scale: number, min = 0, max = Infinity) {
    const oldCenterToPosition = this.position
      .getSub(center)
      .getScaled(1 / this.scale);
    const newScale = clamp(min, this.scale * scale, max);
    const newCenterToPosition = oldCenterToPosition.getScaled(newScale);
    const newPosition = center.getAdd(newCenterToPosition);
    return this.set("position", newPosition).set("scale", newScale);
  }

  rotateAt(center: Vector, degree: number) {
    const oldCenterToPosition = this.position.getSub(center);
    const newCenterToPosition = oldCenterToPosition.getRotated(degree);
    const newPosition = center.getAdd(newCenterToPosition);
    const newRotation = (this.rotation + degree) % 360;
    return this.set("position", newPosition).set("rotation", newRotation);
  }

  setPosition(newPosition: Vector) {
    return this.set("position", newPosition);
  }

  setScale(newScale: number) {
    return this.set("scale", newScale);
  }

  setRotation(newRotation: number) {
    return this.set("rotation", newRotation);
  }
}

export { ViewModel };
