import { Group, Mesh, Vector3, MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneGeometry, InstancedMesh, BufferGeometry } from "three";
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

import { World } from "./world";
import { Client } from "./client";
import { AssetLoader } from "./asset-loader";
import { Center } from "./center";
import { ThingParams, ThingGroup, TileThingGroup, StickThingGroup, MarkerThingGroup } from "./thing-group";
import { ThingType, Place } from "./types";

export interface Render {
  type: ThingType;
  thingIndex: number;
  place: Place;
  selected: boolean;
  hovered: boolean;
  held: boolean;
  temporary: boolean;
  bottom: boolean;
  hidden: boolean;
  transparent: boolean;
}

const MAX_SHADOWS = 300;

export class ObjectView {
  mainGroup: Group;
  private assetLoader: AssetLoader;

  private center: Center;

  private thingGroups: Map<ThingType, ThingGroup>;

  private shadowObject: InstancedMesh;
  private dropShadowProto: Mesh;
  private dropShadowObjects: Array<Mesh>;

  selectedObjects: Array<Mesh>;
  tableMesh: Mesh;

  constructor(mainGroup: Group, assetLoader: AssetLoader, client: Client) {
    this.mainGroup = mainGroup;
    this.assetLoader = assetLoader;

    this.center = new Center(this.assetLoader, client);
    this.center.group.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
    this.dropShadowObjects = [];
    this.selectedObjects = [];

    this.thingGroups = new Map();
    this.thingGroups.set(ThingType.TILE, new TileThingGroup(this.assetLoader, this.mainGroup));
    this.thingGroups.set(ThingType.STICK, new StickThingGroup(this.assetLoader, this.mainGroup));
    this.thingGroups.set(ThingType.MARKER, new MarkerThingGroup(this.assetLoader, this.mainGroup));

    const plane = new PlaneGeometry(1, 1, 1);
    let material = new MeshBasicMaterial({
      transparent: true,
      opacity: 0.1,
      color: 0,
      depthWrite: false,
    });
    this.shadowObject = new InstancedMesh(plane, material, MAX_SHADOWS);
    this.shadowObject.visible = true;
    this.mainGroup.add(this.shadowObject);

    material = material.clone();
    material.opacity = 0.2;

    this.dropShadowProto = new Mesh(plane, material);
    this.dropShadowProto.name = 'dropShadow';

    this.addStatic();
  }

  replaceThings(params: Map<number, ThingParams>): void {
    for (const type of [ThingType.TILE, ThingType.STICK, ThingType.MARKER]) {
      const typeParams = [...params.values()].filter(p => p.type === type);
      typeParams.sort((a, b) => a.index - b.index);

      if (typeParams.length === 0) {
        continue;
      }
      const startIndex = typeParams[0].index;
      const thingGroup = this.thingGroups.get(type)!;
      thingGroup.replace(startIndex, typeParams);
    }
  }

  replaceShadows(places: Array<Place>): void {
    const dummy = new Object3D();

    this.shadowObject.count = 0;
    for (const place of places) {
      dummy.position.set(place.position.x, place.position.y, 0.1);
      dummy.scale.set(place.size.x, place.size.y, 1);
      dummy.updateMatrix();

      const idx = this.shadowObject.count++;
      this.shadowObject.setMatrixAt(idx, dummy.matrix);
    }
    this.shadowObject.instanceMatrix.needsUpdate = true;
  }

  setTableCloth(): void {
    const texture = this.assetLoader.textures.customTableCloth;
    if (!texture) {
      return;
    }

    const material = this.tableMesh.material as MeshLambertMaterial;
    material.map = texture;
  }

  resetTableCloth(): void {
    const material = this.tableMesh.material as MeshLambertMaterial;
    material.map = this.assetLoader.textures.table;
  }


  rotateTableCloth(seat: number): void {
    this.tableMesh.rotation.set(0, 0, Math.PI / 2 * seat);
    this.tableMesh.updateMatrixWorld();
  }

  private addStatic(): void {
    this.tableMesh = this.assetLoader.makeTable();
    this.tableMesh.position.set(World.WIDTH / 2, World.WIDTH / 2, -0.01);
    this.mainGroup.add(this.tableMesh);
    this.tableMesh.updateMatrixWorld();

    this.mainGroup.add(this.center.group);
    this.center.group.updateMatrixWorld(true);

    const tray = this.assetLoader.makeTray();
    tray.updateMatrixWorld();
    const geometries: Array<BufferGeometry> = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 6; j++) {
        const trayPos = new Vector3(
          25 + 24 * j - World.WIDTH / 2,
          -33 * 1.5 - World.WIDTH / 2,
          0
        );
        trayPos.applyAxisAngle(new Vector3(0, 0, 1), Math.PI * i / 2);

        const geometry = tray.geometry.clone();

        geometry.rotateZ(Math.PI * i / 2);
        geometry.translate(
          trayPos.x + World.WIDTH / 2,
          trayPos.y + World.WIDTH / 2,
          0
        );

        geometries.push(geometry);
      }
    }
    tray.geometry = mergeBufferGeometries(geometries);
    tray.position.set(0, 0, 0);
    this.mainGroup.add(tray);
    tray.updateMatrixWorld();
  }

  updateScores(scores: Array<number | null>): void {
    this.center.setScores(scores);
    this.center.draw();
  }

  updateThings(things: Array<Render>): void {
    this.selectedObjects.splice(0);
    for (const thing of things) {
      const thingGroup = this.thingGroups.get(thing.type)!;
      const custom = thing.hovered || thing.selected || thing.held || thing.bottom || thing.hidden;
      if (!custom && thingGroup.canSetSimple()) {
        thingGroup.setSimple(thing.thingIndex, thing.place.position, thing.place.rotation);
        continue;
      }

      const obj = thingGroup.setCustom(
        thing.thingIndex, thing.place.position, thing.place.rotation);

      const material = obj.material as MeshLambertMaterial;
      const wasTransparent = material.transparent;

      material.emissive.setHex(0);
      material.color.setHex(0xeeeeee);
      material.opacity = 1;
      material.transparent = thing.transparent;
      material.depthTest = true;
      obj.renderOrder = 0;

      if (thing.hidden) {
        material.transparent = true;
        material.opacity = 0.0;
      }

      if (thing.hovered) {
        material.emissive.setHex(0x111111);
      }

      if (thing.bottom) {
        material.color.setHex(0xbbbbbb);
      }

      if (thing.selected && !thing.hidden) {
        this.selectedObjects.push(obj);
      }

      if (thing.held) {
        material.transparent = true;
        material.opacity = thing.temporary ? 0.7 : 1;
        material.depthTest = false;
        obj.position.z += 1;
        obj.renderOrder = 2;
      }

      if (material.transparent !== wasTransparent) {
        material.needsUpdate = true;
      }

      obj.updateMatrix();
      obj.updateMatrixWorld();
    }
  }

  updateDropShadows(places: Array<Place>): void {
    for (const obj of this.dropShadowObjects) {
      this.mainGroup.remove(obj);
    }
    this.dropShadowObjects.splice(0);

    for (const place of places) {
      const obj = this.dropShadowProto.clone();
      obj.position.set(
        place.position.x,
        place.position.y,
        place.position.z - place.size.z/2 + 0.2);
      obj.scale.set(place.size.x, place.size.y, 1);
      this.dropShadowObjects.push(obj);
      this.mainGroup.add(obj);
      obj.updateMatrixWorld();
    }
  }
}
