// @ts-ignore
import tableJpg from 'url:../img/table.jpg';
// @ts-ignore
import washizuPng from 'url:../img/tiles.washizu.auto.png';
// @ts-ignore
import extraPng from 'url:../img/tiles.extra.auto.png';
// @ts-ignore
import glbModels from 'url:../img/models.auto.glb';

import { Texture, Mesh, TextureLoader, Material, LinearEncoding,
   MeshStandardMaterial, MeshLambertMaterial, PlaneGeometry, RepeatWrapping } from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { World } from './world';
import { Size } from './types';


export class AssetLoader {
  static readonly worldSize = World.WIDTH + Size.TILE.y * 2;
  private static readonly TableClothLocalStorageKey = "_tableClothDataUrl";
  textures: Record<string, Texture> = {};
  meshes: Record<string, Mesh> = {};

  makeTable(): Mesh {
    const tableGeometry = new PlaneGeometry(
      AssetLoader.worldSize,
      AssetLoader.worldSize
    );
    const tableMaterial = new MeshLambertMaterial({
      color: 0xeeeeee,
      map: this.textures.customTableCloth ?? this.textures.table
    });
    const tableMesh = new Mesh(tableGeometry, tableMaterial);
    return tableMesh;
  }

  makeCenter(): Mesh {
    return this.cloneMesh(this.meshes.center);
  }

  makeNamePlate(): Mesh {
    const mesh = this.cloneMesh(this.meshes.name_plate);
    // (mesh.material as MeshStandardMaterial).color.setHex(0xddddd0);
    return mesh;
  }

  makeTableEdge(): Mesh {
    const mesh = this.cloneMesh(this.meshes.table_edge);
    (mesh.material as MeshStandardMaterial).color.setHex(0xddddd0);
    return mesh;
  }

  makeTray(): Mesh {
    const mesh = this.cloneMesh(this.meshes.tray);
    (mesh.material as MeshStandardMaterial).color.setHex(0x363636);
    return mesh;
  }

  make(what: string): Mesh {
    return this.cloneMesh(this.meshes[what]);
  }

  makeMarker(): Mesh {
    return this.cloneMesh(this.meshes.marker);
  }

  cloneMesh(mesh: Mesh): Mesh {
    const newMesh = mesh.clone();
    if (Array.isArray(mesh.material)) {
      newMesh.material = mesh.material.map(m => m.clone());
    } else {
      newMesh.material = mesh.material.clone();
    }

    return newMesh;
  }

  loadAll(): Promise<void> {
    const tasks = [
      this.loadTexture(tableJpg, 'table'),
      this.loadTexture(extraPng, 'tiles.extra.auto'),
      this.loadTexture(washizuPng, 'tiles.washizu.auto'),
      this.loadModels(glbModels),
      (document as any).fonts.load('40px "Segment7Standard"'),
    ];

    const savedCloth = localStorage.getItem(AssetLoader.TableClothLocalStorageKey);
    if (savedCloth) {
      tasks.push(this.loadTableCloth(savedCloth));
    }

    return Promise.all(tasks).then(() => {
      this.textures.table.wrapS = RepeatWrapping;
      this.textures.table.wrapT = RepeatWrapping;
      this.textures.table.repeat.set(3, 3);
      (this.meshes.tile.material as MeshStandardMaterial).color.setHex(0xeeeeee);
    });
  }

  loadTableCloth(url: string): Promise<void> {
    return this.loadTexture(url, "customTableCloth").then((texture) => {
      texture.flipY = true;
      if (url.length < 600000) {
        localStorage.setItem(AssetLoader.TableClothLocalStorageKey, url);
      }
    });
  }

  forgetTableCloth() {
    localStorage.removeItem(AssetLoader.TableClothLocalStorageKey);
    delete this.textures.customTableCloth;
  }

  loadTexture(url: string, name: string): Promise<Texture> {
    const loader = new TextureLoader();
    return new Promise(resolve => {
      loader.load(url, (texture: Texture) => {
        this.textures[name] = this.processTexture(texture);
        resolve(this.textures[name]);
      });
    });
  }

  loadModels(url: string): Promise<void> {
    const loader = new GLTFLoader();
    return new Promise(resolve => {
      loader.load(url, (model: GLTF) => {
        for (const obj of model.scene.children) {
          if ((obj as Mesh).isMesh) {
            this.meshes[obj.name] = this.processMesh(obj as Mesh);
          } else {
            // eslint-disable-next-line no-console
            console.warn('unrecognized object', obj);
          }
        }
        resolve();
      });
    });
  }

  processTexture(texture: Texture): Texture {
    texture.flipY = false;
    texture.anisotropy = 4;
    return texture;
  }

  private processMesh(mesh: Mesh): Mesh {
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(this.processMaterial.bind(this));
    } else {
      mesh.material = this.processMaterial(mesh.material);
    }
    return mesh;
  }

  private processMaterial(material: Material): Material {
    const standard = material as MeshStandardMaterial;
    const map = standard.map;
    if (map !== null) {
      map.encoding = LinearEncoding;
      map.anisotropy = 4;
    }
    return new MeshLambertMaterial({map});
  }
}
