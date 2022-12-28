import { Vector3, Euler, Mesh, Group, Material, InstancedMesh, Matrix4, BufferGeometry, MeshLambertMaterial, InstancedBufferGeometry, InstancedBufferAttribute, Vector4, Color, DoubleSide, MeshLambertMaterialParameters } from "three";
import { AssetLoader } from "./asset-loader";
import { ThingType } from "./types";

const TILE_DU = 1 / 10;
const TILE_DV = 1 / 8;
const STICK_DV = 1 / 6;

export interface ThingParams {
  type: ThingType;
  typeIndex: number;
  index: number;
}

export abstract class ThingGroup {
  protected assetLoader: AssetLoader;
  protected startIndex: number = 0;
  protected meshes: Array<Mesh> = [];
  protected group: Group;

  abstract createMesh(typeIndex: number): Mesh;

  constructor(assetLoader: AssetLoader, group: Group) {
    this.assetLoader = assetLoader;
    this.group = group;
  }

  canSetSimple(): boolean {
    return false;
  }

  setSimple(index: number, position: Vector3, rotation: Euler): void {}

  setCustom(index: number, position: Vector3, rotation: Euler): Mesh {
    const mesh = this.meshes[index - this.startIndex];
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    return mesh;
  }

  replace(startIndex: number, params: Array<ThingParams>): void {
    for (const mesh of this.meshes) {
      (mesh.material as Material).dispose();
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    this.meshes.splice(0);

    for (const p of params) {
      const mesh = this.createMesh(p.typeIndex);
      mesh.matrixAutoUpdate = false;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.startIndex = startIndex;
  }
}

export class MarkerThingGroup extends ThingGroup {
  createMesh(typeIndex: number): Mesh {
    return this.assetLoader.makeMarker();
  }
}

abstract class InstancedThingGroup extends ThingGroup {
  protected instancedMeshGroups: Record<number, InstancedMesh> | null = null;
  protected indexToGroupMap: number[] | null = null;
  private zero: Matrix4 = new Matrix4().makeScale(0, 0, 0);

  abstract getOriginalMesh(): Mesh;
  abstract getUvChunk(): string;
  abstract getOffset(typeIndex: number): Vector3;

  canSetSimple(): boolean {
    return true;
  }

  protected createMaterial(): MeshLambertMaterial {
    const origMesh = this.getOriginalMesh();
    const origMaterial = origMesh.material as MeshLambertMaterial;

    const material = new MeshLambertMaterial({
      map: origMaterial.map,
      color: origMaterial.color,
    });

    const paramChunk = `
attribute vec4 offset;
#include <common>
`;
    const uvChunk = this.getUvChunk();
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', paramChunk)
        .replace('#include <uv_vertex>', uvChunk);
    };

    // Fix cache conflict: https://github.com/mrdoob/three.js/issues/19377
    material.defines = material.defines ?? {};
    material.defines.THING_TYPE = origMesh.name;
    return material;
  }

  protected createInstancedMesh(params: Array<ThingParams>): InstancedMesh {
    const material = this.createMaterial();
    const data = new Float32Array(params.length * 3);
    for (let i = 0; i < params.length; i++) {
      const v = this.getOffset(params[i].typeIndex);
      data[3 * i] = v.x;
      data[3 * i + 1] = v.y;
      data[3 * i + 2] = v.z;
    }

    const origMesh = this.getOriginalMesh();
    const geometry = new InstancedBufferGeometry().copy(origMesh.geometry as BufferGeometry);
    geometry.setAttribute('offset', new InstancedBufferAttribute(data, 3));
    const instancedMesh = new InstancedMesh(geometry, material, params.length);
    return instancedMesh;
  }

  replace(startIndex: number, params: Array<ThingParams>): void {
    super.replace(startIndex, params);

    if (this.instancedMeshGroups !== null) {
      for(const meshType of (Object.values(this.instancedMeshGroups))) {
        (meshType.material as Material).dispose();
        meshType.geometry.dispose();
        this.group.remove(meshType);
      }
    }

    this.instancedMeshGroups = this.createInstanceMeshGroups(params);
    for(const meshType of Object.values(this.instancedMeshGroups)) {
      this.group.add(meshType);
    }

    this.indexToGroupMap = [];
    for (const p of params) {
      this.indexToGroupMap.push(this.getGroupIndex(p.typeIndex));
    }
  }

  protected createInstanceMeshGroups(params: ThingParams[]): Record<number, InstancedMesh> {
    const mesh = this.createInstancedMesh(params);
    return { 0: mesh };
  }

  protected getGroupIndex(index: number): number {
    return 0;
  }

  setSimple(index: number, position: Vector3, rotation: Euler): void {
    const i = index - this.startIndex;
    const mesh = this.meshes[i];
    if (!mesh.visible && mesh.position.equals(position) && mesh.rotation.equals(rotation)) {
      return;
    }
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.updateMatrix();
    mesh.visible = false;

    if (this.instancedMeshGroups === null || this.indexToGroupMap === null) {
      return;
    }

    const activeGroupId = this.indexToGroupMap[i].toString();

    for(const [groupId, groupMesh] of Object.entries(this.instancedMeshGroups)) {
      if (activeGroupId === groupId) {
        groupMesh.setMatrixAt(i, mesh.matrix);
      } else {
        groupMesh.setMatrixAt(i, this.zero);
      }
      groupMesh.instanceMatrix.needsUpdate = true;
    }
  }

  setCustom(index: number, position: Vector3, rotation: Euler): Mesh {
    const i = index - this.startIndex;
    const mesh = this.meshes[i];
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.visible = true;

    if (this.instancedMeshGroups === null) {
      return mesh;
    }

    for(const groupMesh of Object.values(this.instancedMeshGroups)) {
      groupMesh.setMatrixAt(i, this.zero);
      groupMesh.instanceMatrix.needsUpdate = true;
    }

    return mesh;
  }
}

export class TileThingGroup extends InstancedThingGroup {
  createInstanceMeshGroups(params: ThingParams[]): Record<number, InstancedMesh> {
    const mesh = this.createInstancedMesh(params);
    mesh.renderOrder = 1;
    const washizuMesh = this.createInstancedMesh(params);
    const material = this.createMaterial();
    material.map = this.assetLoader.textures["tiles.washizu.auto"];
    material.transparent = true;
    material.depthWrite = false;
    material.side = DoubleSide;
    washizuMesh.material = material;
    return {
      0: mesh,
      1: washizuMesh
    };
  }

  getGroupIndex(typeIndex: number): number {
    return (typeIndex & (1 << 10)) >> 10;
  }

  protected name: string = 'tile';

  getOriginalMesh(): Mesh {
    return this.assetLoader.meshes.tile;
  }

  getUvChunk(): string {
    return `
#include <uv_vertex>
if (vUv.x <= ${TILE_DU}) {
  vUv.x += offset.x;
  vUv.y += offset.y;
} else {
  vUv.y += offset.z;
}
`;
  }

  getOffset(typeIndex: number): Vector3 {
    const back = (typeIndex & (1 << 8)) >> 8;
    const dora = (typeIndex & (1 << 9)) >> 9;
    typeIndex &= 0xff;
    const x = typeIndex % 40 % 9;
    const  y = Math.floor(typeIndex % 40 / 9) + dora * 4;
    return new Vector3(x * TILE_DU, y * TILE_DV, back * TILE_DV * 4);
  }

  createMesh(typeIndex: number): Mesh {
    const mesh = this.assetLoader.make('tile');

    const offset = this.getOffset(typeIndex);

    // Clone geometry and modify front face
    const geometry = mesh.geometry.clone() as BufferGeometry;
    mesh.geometry = geometry;
    const uvs: Float32Array = geometry.attributes.uv.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      if (uvs[i] <= TILE_DU) {
        uvs[i] += offset.x;
        uvs[i+1] += offset.y;
      } else {
        uvs[i+1] += offset.z;
      }
    }

    if (this.getGroupIndex(typeIndex) === 1) {
      const material = mesh.material as MeshLambertMaterial;
      material.map = this.assetLoader.textures['tiles.washizu.auto'];
      material.side = DoubleSide;
      material.transparent = true;
      material.depthWrite = false;
    } else {
      mesh.renderOrder = 1;
    }

    return mesh;
  }
}

export class StickThingGroup extends InstancedThingGroup {
  getOriginalMesh(): Mesh {
    return this.assetLoader.meshes.stick;
  }

  getUvChunk(): string {
    return `
#include <uv_vertex>
vUv += offset.xy;
`;
  }

  getOffset(typeIndex: number): Vector3 {
    return new Vector3(0, typeIndex * STICK_DV, 0);
  }

  createMesh(typeIndex: number): Mesh {
    const mesh = this.assetLoader.make('stick');

    const geometry = mesh.geometry.clone() as BufferGeometry;
    mesh.geometry = geometry;
    const uvs: Float32Array = geometry.attributes.uv.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i+1] += typeIndex * STICK_DV;
    }

    return mesh;
  }
}
