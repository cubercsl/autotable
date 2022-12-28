import { Quaternion } from "three";
import { ThingType, Place } from "./types";
import { Slot } from "./slot";

export class Thing {
  index: number;
  type: ThingType;
  typeIndex: number;
  slot: Slot;
  rotationIndex: number;

  claimedBy: number | null;
  // used when claimedBy !== null:
  readonly heldRotation: Quaternion;
  shiftSlot: Slot | null;

  // For animation
  lastShiftSlot: Slot | null;
  lastShiftSlotTime: number;

  sent: boolean;

  constructor(index: number, type: ThingType, typeIndex: number, slot: Slot) {
    this.index = index;
    this.type = type;
    this.typeIndex = typeIndex;
    this.slot = slot;
    this.rotationIndex = 0;
    this.claimedBy = null;
    this.heldRotation = new Quaternion();
    this.shiftSlot = null;

    this.lastShiftSlot = null;
    this.lastShiftSlotTime = 0;

    this.sent = false;

    this.slot.thing = this;
  }

  place(): Place {
    return this.slot.placeWithOffset(this.rotationIndex);
  }

  flip(rotationIndex?: number): void {
    if (rotationIndex === undefined) {
      rotationIndex = this.rotationIndex + 1;
    }
    const r = this.slot.rotations.length;
    this.rotationIndex = (rotationIndex + r) % r;
    this.sent = false;
  }

  prepareMove(): void {
    this.slot.thing = null;
  }

  moveTo(target: Slot, rotationIndex?: number): void {
    if (target.thing !== null) {
      throw `slot not empty: ${this.index} ${target.name}`;
    }
    this.slot = target;
    this.rotationIndex = rotationIndex ?? 0;
    target.thing = this;

    this.sent = false;
  }

  hold(seat: number): void {
    this.claimedBy = seat;
    this.heldRotation.copy(this.place().rotation);
    this.sent = false;
  }

  shiftTo(seat: number, slot: Slot): void {
    this.claimedBy = seat;
    this.shiftSlot = slot;
    this.sent = false;
  }

  release(local?: boolean): void {
    this.claimedBy = null;
    this.shiftSlot = null;
    if (!local) {
      this.sent = false;
    }
  }

  getTypeIndexNoFlags(): number {
    return this.typeIndex & 0xff;
  }

  isTransparent(): boolean {
    return (this.typeIndex & (1 << 10)) > 0;
  }
}
