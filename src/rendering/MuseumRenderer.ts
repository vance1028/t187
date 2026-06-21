import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Agent, Exhibit, Layout, Showcase, Wall } from '../simulation/types'
import type { MuseumSimulator } from '../simulation/simulator'
import { heatmapToImage, heatColor } from '../simulation/heatmap'

export class MuseumRenderer {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  container: HTMLElement

  layoutGroup: THREE.Group
  agentGroup: THREE.Group
  heatmapGroup: THREE.Group

  agentMeshes: Map<number, THREE.Group> = new Map()
  exhibitLabels: Map<string, THREE.Mesh> = new Map()
  heatmapCanvas: HTMLCanvasElement
  heatmapTexture: THREE.CanvasTexture
  heatmapMesh: THREE.Mesh | null = null

  constructor(container: HTMLElement, simulator: MuseumSimulator) {
    this.container = container
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a1a)

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      500
    )
    this.camera.position.set(38, 55, 75)
    this.camera.lookAt(38, 0, 22)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI * 0.48
    this.controls.minDistance = 15
    this.controls.maxDistance = 150
    this.controls.target.set(38, 0, 22)

    this.layoutGroup = new THREE.Group()
    this.agentGroup = new THREE.Group()
    this.heatmapGroup = new THREE.Group()
    this.scene.add(this.layoutGroup, this.agentGroup, this.heatmapGroup)

    this.heatmapCanvas = document.createElement('canvas')
    this.heatmapTexture = new THREE.CanvasTexture(this.heatmapCanvas)
    this.heatmapTexture.magFilter = THREE.LinearFilter
    this.heatmapTexture.minFilter = THREE.LinearFilter

    this.setupLights()
    this.buildLayout(simulator.layout)
    this.buildHeatmap(simulator)

    window.addEventListener('resize', this.onResize)
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0x8090b0, 0.55)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xfff0e0, 0.9)
    dir.position.set(50, 80, 30)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    const b = 100
    dir.shadow.camera.left = -b
    dir.shadow.camera.right = b
    dir.shadow.camera.top = b
    dir.shadow.camera.bottom = -b
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 200
    this.scene.add(dir)

    const fill = new THREE.DirectionalLight(0x8899cc, 0.3)
    fill.position.set(-30, 40, -20)
    this.scene.add(fill)

    const spotCount = 5
    for (let i = 0; i < spotCount; i++) {
      const spot = new THREE.PointLight(0xffddaa, 0.4, 40)
      spot.position.set(15 + i * 12, 8, 8 + (i % 3) * 12)
      this.scene.add(spot)
    }
  }

  private buildLayout(layout: Layout) {
    this.layoutGroup.clear()

    for (const hall of layout.halls) {
      const w = hall.bounds.maxX - hall.bounds.minX
      const h = hall.bounds.maxZ - hall.bounds.minZ
      const cx = (hall.bounds.minX + hall.bounds.maxX) / 2
      const cz = (hall.bounds.minZ + hall.bounds.maxZ) / 2
      const geom = new THREE.PlaneGeometry(w, h, 1, 1)
      const mat = new THREE.MeshStandardMaterial({
        color: hall.floorColor,
        roughness: 0.85,
        metalness: 0.1
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(cx, -0.01, cz)
      mesh.receiveShadow = true
      this.layoutGroup.add(mesh)

      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.02, 0.02, h + 0.02)),
        new THREE.LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.6 })
      )
      border.position.set(cx, 0.005, cz)
      this.layoutGroup.add(border)
    }

    const gridHelper = new THREE.GridHelper(100, 100, 0x223344, 0x1a2538)
    gridHelper.position.set(40, 0.002, 22)
    ;(gridHelper.material as THREE.Material).transparent = true
    ;(gridHelper.material as THREE.Material).opacity = 0.35
    this.layoutGroup.add(gridHelper)

    for (const wall of layout.walls) {
      this.addWall(wall)
    }

    for (const sc of layout.showcases) {
      this.addShowcase(sc)
    }

    for (const ex of layout.exhibits) {
      this.addExhibit(ex)
    }

    for (const ent of layout.entrances) {
      this.addMarker(ent.position, 0x4ade80, '入口')
    }
    for (const ex of layout.exits) {
      this.addMarker(ex.position, 0xf87171, '出口')
    }
  }

  private addWall(wall: Wall) {
    const dx = wall.end.x - wall.start.x
    const dz = wall.end.z - wall.start.z
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len < 0.01) return
    const cx = (wall.start.x + wall.end.x) / 2
    const cz = (wall.start.z + wall.end.z) / 2
    const angle = Math.atan2(dz, dx)

    const geom = new THREE.BoxGeometry(len, wall.height, wall.thickness)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6b5b4a,
      roughness: 0.75,
      metalness: 0.1
    })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.set(cx, wall.height / 2, cz)
    mesh.rotation.y = -angle
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.layoutGroup.add(mesh)

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(len + 0.05, 0.12, wall.thickness + 0.08),
      new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.6 })
    )
    top.position.set(cx, wall.height - 0.05, cz)
    top.rotation.y = -angle
    this.layoutGroup.add(top)
  }

  private addShowcase(sc: Showcase) {
    const group = new THREE.Group()

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.4 })
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(sc.width + 0.1, 0.5, sc.depth + 0.1),
      baseMat
    )
    base.position.y = 0.25
    base.castShadow = true
    base.receiveShadow = true
    group.add(base)

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xccddff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.85,
      thickness: 0.1,
      clearcoat: 1
    })
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(sc.width, 1.3, sc.depth),
      glassMat
    )
    glass.position.y = 0.5 + 0.65
    group.add(glass)

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(sc.width, 1.3, sc.depth)),
      new THREE.LineBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.7 })
    )
    edges.position.y = 0.5 + 0.65
    group.add(edges)

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(sc.width + 0.06, 0.08, sc.depth + 0.06),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 })
    )
    top.position.y = 0.5 + 1.3 + 0.04
    group.add(top)

    group.position.set(sc.position.x, 0, sc.position.z)
    group.rotation.y = sc.rotation
    this.layoutGroup.add(group)
  }

  private addExhibit(ex: Exhibit) {
    const group = new THREE.Group()
    const baseY = ex.showcaseId ? 1.15 : 0.6
    const size = ex.isKeyExhibit ? 0.55 : 0.4
    const color = ex.isKeyExhibit ? 0xffd700 : 0xc0a080

    let mainMesh: THREE.Mesh
    if (ex.isKeyExhibit) {
      const geom = new THREE.CylinderGeometry(size * 0.4, size * 0.7, size * 1.3, 8)
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.75,
        emissive: 0x332200,
        emissiveIntensity: 0.4
      })
      mainMesh = new THREE.Mesh(geom, mat)
    } else {
      const shape = (ex.id.charCodeAt(ex.id.length - 1) + 3) % 3
      let geom: THREE.BufferGeometry
      if (shape === 0) geom = new THREE.BoxGeometry(size, size * 1.2, size * 0.7)
      else if (shape === 1) geom = new THREE.SphereGeometry(size * 0.6, 16, 12)
      else geom = new THREE.ConeGeometry(size * 0.5, size * 1.3, 6)
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.3
      })
      mainMesh = new THREE.Mesh(geom, mat)
    }
    mainMesh.position.y = baseY
    mainMesh.castShadow = true
    group.add(mainMesh)

    if (ex.isKeyExhibit) {
      const star = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.35, 5),
        new THREE.MeshBasicMaterial({ color: 0xffee00 })
      )
      star.position.y = baseY + size + 0.25
      star.rotation.x = Math.PI
      group.add(star)

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 0.85, size * 1.05, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = baseY - size * 0.3
      group.add(ring)

      const pointLight = new THREE.PointLight(0xffdd66, 1.2, 4, 2)
      pointLight.position.y = baseY + 0.5
      group.add(pointLight)
    }

    const labelCanvas = this.makeTextCanvas(ex.name, ex.isKeyExhibit)
    const labelTex = new THREE.CanvasTexture(labelCanvas)
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(labelCanvas.width / 70, labelCanvas.height / 70),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false })
    )
    label.position.y = baseY + size + 0.9
    label.rotation.x = -0.35
    group.add(label)
    this.exhibitLabels.set(ex.id, label)

    group.position.set(ex.position.x, 0, ex.position.z)
    group.rotation.y = ex.rotation
    this.layoutGroup.add(group)
  }

  private makeTextCanvas(text: string, highlighted: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const fontSize = 18
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    const metrics = ctx.measureText(text)
    const padding = 10
    const w = Math.ceil(metrics.width) + padding * 2
    const h = fontSize + padding * 2 - 4
    canvas.width = w
    canvas.height = h
    const ctx2 = canvas.getContext('2d')!
    ctx2.fillStyle = highlighted ? 'rgba(255, 120, 0, 0.9)' : 'rgba(20, 30, 60, 0.85)'
    this.roundRect(ctx2, 0, 0, w, h, 5)
    ctx2.fill()
    ctx2.strokeStyle = highlighted ? '#ffd700' : '#60a5fa'
    ctx2.lineWidth = 1.5
    this.roundRect(ctx2, 0, 0, w, h, 5)
    ctx2.stroke()
    ctx2.fillStyle = highlighted ? '#fff' : '#e0e0ff'
    ctx2.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx2.textBaseline = 'middle'
    ctx2.fillText(text, padding, h / 2 + 1)
    return canvas
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  private addMarker(pos: { x: number; z: number }, color: number, label: string) {
    const group = new THREE.Group()
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.2, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    group.add(ring)
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 })
    )
    pole.position.y = 1.25
    group.add(pole)
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
    )
    top.position.y = 2.6
    group.add(top)

    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 36
    const c = canvas.getContext('2d')!
    c.fillStyle = 'rgba(10,20,40,0.85)'
    this.roundRect(c, 0, 0, 100, 36, 6)
    c.fill()
    c.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    c.font = 'bold 18px "PingFang SC", sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(label, 50, 18)
    const tex = new THREE.CanvasTexture(canvas)
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.72),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    )
    lbl.position.y = 3.3
    lbl.rotation.x = -0.4
    group.add(lbl)

    group.position.set(pos.x, 0, pos.z)
    this.layoutGroup.add(group)
  }

  private buildHeatmap(sim: MuseumSimulator) {
    const h = sim.heatmap
    const hw = h.gridWidth * h.cellSize
    const hh = h.gridHeight * h.cellSize
    const cx = h.origin.x + hw / 2
    const cz = h.origin.z + hh / 2

    this.heatmapCanvas.width = h.gridWidth
    this.heatmapCanvas.height = h.gridHeight
    this.heatmapTexture.needsUpdate = true

    const geom = new THREE.PlaneGeometry(hw, hh, 1, 1)
    const mat = new THREE.MeshBasicMaterial({
      map: this.heatmapTexture,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    this.heatmapMesh = new THREE.Mesh(geom, mat)
    this.heatmapMesh.rotation.x = -Math.PI / 2
    this.heatmapMesh.position.set(cx, 0.03, cz)
    this.heatmapGroup.add(this.heatmapMesh)
    this.updateHeatmap(sim)
  }

  updateHeatmap(sim: MuseumSimulator) {
    const h = sim.heatmap
    const imgData = heatmapToImage(h, 10)
    const ctx = this.heatmapCanvas.getContext('2d')!
    ctx.clearRect(0, 0, this.heatmapCanvas.width, this.heatmapCanvas.height)
    const img = ctx.createImageData(imgData.width, imgData.height)
    for (let i = 0; i < imgData.data.length; i++) {
      img.data[i] = imgData.data[i]
    }
    ctx.putImageData(img, 0, 0)
    this.heatmapTexture.needsUpdate = true
  }

  updateAgents(sim: MuseumSimulator) {
    const current = new Set<number>()
    for (const a of sim.agents) {
      current.add(a.id)
      let mesh = this.agentMeshes.get(a.id)
      if (!mesh) {
        mesh = this.createAgentMesh(a)
        this.agentGroup.add(mesh)
        this.agentMeshes.set(a.id, mesh)
      }
      mesh.position.set(a.position.x, 0, a.position.z)
      const speedSq = a.velocity.x * a.velocity.x + a.velocity.z * a.velocity.z
      if (speedSq > 0.0001) {
        const targetAngle = Math.atan2(a.velocity.x, a.velocity.z)
        mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetAngle, 0.25)
      }
      const viewing = a.state === 'viewing'
      const indicator = mesh.getObjectByName('view_indicator') as THREE.Mesh
      if (indicator) {
        indicator.visible = viewing
        if (viewing) {
          ;(indicator.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(sim.time * 6) * 0.2
        }
      }
      const headBob = mesh.getObjectByName('head') as THREE.Mesh
      if (headBob && speedSq > 0.01) {
        headBob.position.y = 1.55 + Math.sin(sim.time * 10) * 0.04
      } else if (headBob) {
        headBob.position.y = 1.55
      }
    }

    for (const [id, mesh] of this.agentMeshes) {
      if (!current.has(id)) {
        this.agentGroup.remove(mesh)
        this.disposeGroup(mesh)
        this.agentMeshes.delete(id)
      }
    }
  }

  private createAgentMesh(a: Agent): THREE.Group {
    const g = new THREE.Group()
    const bodyColor = new THREE.Color(a.color)

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.7,
      metalness: 0.1
    })
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.55, 4, 8),
      bodyMat
    )
    body.position.y = 0.95
    body.castShadow = true
    g.add(body)

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      roughness: 0.6
    })
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), headMat)
    head.name = 'head'
    head.position.y = 1.55
    head.castShadow = true
    g.add(head)

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.28, 0.05, 12),
      new THREE.MeshBasicMaterial({ color: bodyColor, transparent: true, opacity: 0.55 })
    )
    base.position.y = 0.03
    g.add(base)

    const indicator = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 16),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    )
    indicator.rotation.x = -Math.PI / 2
    indicator.position.y = 0.04
    indicator.name = 'view_indicator'
    indicator.visible = false
    g.add(indicator)

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.015
    g.add(shadow)

    return g
  }

  private disposeGroup(g: THREE.Group) {
    g.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of mats) m.dispose()
      }
    })
  }

  updateExhibitLabels(sim: MuseumSimulator) {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    for (const [id, mesh] of this.exhibitLabels) {
      const ex = sim.layout.exhibits.find(e => e.id === id)
      if (!ex) continue
      const worldPos = new THREE.Vector3()
      mesh.getWorldPosition(worldPos)
      mesh.lookAt(worldPos.x + dir.x * 10, worldPos.y + dir.y * 10, worldPos.z + dir.z * 10)
    }
  }

  update(dt: number, sim: MuseumSimulator) {
    this.controls.update()
    this.updateAgents(sim)
    this.updateHeatmap(sim)
    this.updateExhibitLabels(sim)

    const t = sim.time
    for (const [id, mesh] of this.exhibitLabels) {
      const ex = sim.layout.exhibits.find(e => e.id === id)
      if (ex?.isKeyExhibit) {
        const parent = mesh.parent!
        parent.rotation.y = Math.sin(t * 0.5 + id.length) * 0.1
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  onResize = () => {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  dispose() {
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
    this.controls.dispose()
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }
}

export { heatColor }
