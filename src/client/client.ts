import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import Stats from 'three/examples/jsm/libs/stats.module'
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer'
import CameraControls from 'camera-controls'

CameraControls.install({ THREE: THREE })

let annotations: { [key: string]: Annotation }
const annotationMarkers: THREE.Sprite[] = []

const scene = new THREE.Scene()

// const axesHelper = new THREE.AxesHelper(5)
// scene.add(axesHelper)

const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff00,
})

let spotLight = new THREE.SpotLight(0xffffff, 0.8)
spotLight.position.set(45, 50, 15)
scene.add(spotLight)

let ambLight = new THREE.AmbientLight(0x333333)
ambLight.position.set(5, 3, 5)
scene.add(ambLight)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.x = 3.2
camera.position.y = 2.3
camera.position.z = 0

const renderer = new THREE.WebGLRenderer({ alpha: true })
renderer.setClearColor(0x000000, 0) // the default
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(window.innerWidth, window.innerHeight)
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0px'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

const controls = new CameraControls(camera, renderer.domElement)
controls.minDistance = 1.5
controls.maxDistance = 10
controls.dampingFactor = 0.1
controls.dollySpeed = 3

const raycaster = new THREE.Raycaster()

const circleTexture = new THREE.TextureLoader().load('img/circle.png')

const progressBar = document.getElementById('progressBar') as HTMLProgressElement

const loader = new GLTFLoader()
loader.load(
    'models/honda/source/hondas800.glb',
    (object) => {
        scene.add(object.scene)
        object.scene.rotateY(3.14)

        const annotationsDownload = new XMLHttpRequest()
        annotationsDownload.open('GET', '/data/annotations.json')
        annotationsDownload.onreadystatechange = function () {
            if (annotationsDownload.readyState === 4) {
                annotations = JSON.parse(annotationsDownload.responseText)

                const annotationsPanel = document.getElementById(
                    'annotationsPanel'
                ) as HTMLDivElement
                const ul = document.createElement('UL') as HTMLUListElement
                const ulElem = annotationsPanel.appendChild(ul)
                Object.keys(annotations).forEach((a) => {
                    const li = document.createElement('LI') as HTMLLIElement
                    const liElem = ulElem.appendChild(li)
                    const button = document.createElement('BUTTON') as HTMLButtonElement
                    button.innerHTML = a + ' : ' + annotations[a].title
                    button.className = 'annotationButton'
                    button.addEventListener('click', function () {
                        gotoAnnotation(annotations[a])
                    })
                    liElem.appendChild(button)

                    const annotationSpriteMaterial = new THREE.SpriteMaterial({
                        map: circleTexture,
                        depthTest: false,
                        depthWrite: false,
                        sizeAttenuation: false,
                    })
                    const annotationSprite = new THREE.Sprite(annotationSpriteMaterial)
                    annotationSprite.scale.set(0.066, 0.066, 0.066)
                    annotationSprite.position.copy(annotations[a].lookAt)
                    annotationSprite.userData.id = a
                    scene.add(annotationSprite)
                    annotationMarkers.push(annotationSprite)

                    const annotationDiv = document.createElement('div')
                    annotationDiv.className = 'annotationLabel'
                    annotationDiv.innerHTML = a
                    const annotationLabel = new CSS2DObject(annotationDiv)
                    annotationLabel.position.copy(annotations[a].lookAt)
                    scene.add(annotationLabel)

                    if (annotations[a].linePointingAt) addLine(annotations[a])

                    if (annotations[a].description) {
                        const annotationDescriptionDiv = document.createElement('div')
                        annotationDescriptionDiv.className = 'annotationDescription'
                        annotationDescriptionDiv.innerHTML = annotations[a].description
                        annotationDiv.appendChild(annotationDescriptionDiv)
                        annotations[a].descriptionDomElement = annotationDescriptionDiv
                    }
                })
                progressBar.style.display = 'none'
            }
        }
        annotationsDownload.send()
    },
    // called when loading is in progresses
    (xhr) => {
        if (xhr.lengthComputable) {
            let percentComplete = (xhr.loaded / xhr.total) * 100
            progressBar.value = percentComplete
            progressBar.style.display = 'block'
        }
    },
    (error) => {
        console.log('An error happened')
    }
)

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

renderer.domElement.addEventListener('click', onClick, false)
function onClick(event: MouseEvent) {
    raycaster.setFromCamera(
        {
            x: (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
            y: -(event.clientY / renderer.domElement.clientHeight) * 2 + 1,
        },
        camera
    )

    const intersects = raycaster.intersectObjects(annotationMarkers, true)
    if (intersects.length > 0) {
        if (intersects[0].object.userData && intersects[0].object.userData.id) {
            gotoAnnotation(annotations[intersects[0].object.userData.id])
        }
    }
}

function gotoAnnotation(a: any): void {
    // new TWEEN.Tween(camera.position)
    //     .to(
    //         {
    //             x: a.camPos.x,
    //             y: a.camPos.y,
    //             z: a.camPos.z,
    //         },
    //         800
    //     )
    //     .easing(TWEEN.Easing.Cubic.Out)
    //     .start()

    controls.setPosition(a.camPos.x, a.camPos.y, a.camPos.z, true)

    Object.keys(annotations).forEach((annotation) => {
        if (annotations[annotation].descriptionDomElement) {
            ;(annotations[annotation].descriptionDomElement as HTMLElement).style.display = 'none'
        }
    })
    if (a.descriptionDomElement) {
        a.descriptionDomElement.style.display = 'block'
    }
}

function addLine(a: any): void {
    const points = []
    points.push(new THREE.Vector3(a.lookAt.x, a.lookAt.y, a.lookAt.z))
    points.push(new THREE.Vector3(a.linePointingAt.x, a.linePointingAt.y, a.linePointingAt.z))

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)

    const line = new THREE.Line(lineGeometry, lineMaterial)
    scene.add(line)
}

const stats = Stats()
document.body.appendChild(stats.dom)

const cameraTracker = document.getElementById('cameraTracker')
function trackCamera() {
    cameraTracker!.innerHTML = `
<p>X: ${camera.position.x.toFixed(2)}</p>
<p>Y: ${camera.position.y.toFixed(2)}</p>
<p>Z: ${camera.position.z.toFixed(2)}</p>`
}

const zoomInButton = document.querySelector('.zoom-in')!
zoomInButton.addEventListener('click', () => handleZoom('+'))
const zoomOutButton = document.querySelector('.zoom-out')!
zoomOutButton.addEventListener('click', () => handleZoom('-'))

function handleZoom(direction: '+' | '-') {
    if (direction === '+') controls.dolly(1, true)
    if (direction === '-') controls.dolly(-1, true)
}

const rotateRightButton = document.querySelector('.rotate-right')!
rotateRightButton.addEventListener('click', () => {
    handleRotate('right')
})
const rotateLeftButton = document.querySelector('.rotate-left')!
rotateLeftButton.addEventListener('click', () => {
    handleRotate('left')
})

function handleRotate(direction: 'left' | 'right') {
    if (direction === 'left') controls.rotate(45 * THREE.MathUtils.DEG2RAD, 0, true)
    if (direction === 'right') controls.rotate(-45 * THREE.MathUtils.DEG2RAD, 0, true)
}

const clock = new THREE.Clock()

function animate() {
    const delta = clock.getDelta()
    controls.update(delta)

    requestAnimationFrame(animate)

    TWEEN.update()

    render()

    stats.update()

    trackCamera()
}

function render() {
    labelRenderer.render(scene, camera)
    renderer.render(scene, camera)
}

animate()
