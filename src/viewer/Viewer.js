( function () {

	var container,
		camera,
		scene,
		renderer,
		controls,
		OrbitControls,
		DeviceOrientationControls,
		userMouse,
		raycaster,
		panorama,
		hoveringObject,
		widget,
		renderableObjectList = [],
		DEBUG = false;

	/**
	 * Viewer contains pre-defined scene, camera and renderer
	 * @constructor
	 * @param {object} [options] - Use custom or default config options
	 * @param {HTMLElement} [options.container] - A HTMLElement to host the canvas
	 * @param {THREE.Scene} [options.scene=THREE.Scene] - A THREE.Scene which contains panorama and 3D objects
	 * @param {THREE.Camera} [options.camera=THREE.PerspectiveCamera] - A THREE.Camera to view the scene
	 * @param {THREE.WebGLRenderer} [options.renderer=THREE.WebGLRenderer] - A THREE.WebGLRenderer to render canvas
	 * @param {boolean} [options.controlBar=true] - Show/hide control bar on the bottom of the container
	 */
	PANOLENS.Viewer = function ( options ) {

		THREE.EventDispatcher.call( this );
		
		if ( !THREE ) {

			console.error('Three.JS not found');

			return;
		}

		options = options || {};

		// Container
		if ( options.container ) {

			container = options.container;

		} else {

			container = document.createElement('div');
			document.body.appendChild( container );

		}
		container.addEventListener( 'mousedown', onMouseDown, false );
		container.addEventListener( 'mousemove', onMouseMove, false );
		container.addEventListener( 'mouseup', onMouseUp, false );
		container.addEventListener( 'touchstart', onMouseDown, false );
		container.addEventListener( 'touchend', onMouseUp, false );

		// Scene
		scene = options.scene || new THREE.Scene();

		// Camera
		camera = options.camera || new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 10000 );

		// Renderer
		if ( options.renderer ) {

			renderer = options.renderer;

		} else {

			renderer = new THREE.WebGLRenderer( { antialias: true } );
			renderer.setPixelRatio( window.devicePixelRatio );
			renderer.setSize( window.innerWidth, window.innerHeight );

		}

		// Append Renderer Element to container
		renderer.domElement.classList.add( 'panolens-canvas' );
		container.appendChild( renderer.domElement );

		// Utility
		raycaster = new THREE.Raycaster();
		userMouse = new THREE.Vector2();

		// Orbit and Deviceorientation Camera Controls
		OrbitControls = new THREE.OrbitControls( camera, container );
		OrbitControls.name = 'orbit';
		OrbitControls.minDistance = 1;
		OrbitControls.noPan = true;
		DeviceOrientationControls = new THREE.DeviceOrientationControls( camera );
		DeviceOrientationControls.name = 'device-orientation';

		controls = [ OrbitControls, DeviceOrientationControls ];
		this.control = OrbitControls;

		// Add Control UI
		if ( options.controlBar !== false ) {
			widget = new PANOLENS.Widget( container );
			widget.addEventListener( 'panolens-viewer-handler', this.eventHandler.bind( this ) );
			widget.addDefaultControlBar();
		}
		
		// Resize Event
		window.addEventListener( 'resize', this.onWindowResize.bind( this ), false );

		// Keyboard Event
		window.addEventListener( 'keydown', onKeyDown, false );
		window.addEventListener( 'keyup', onKeyUp, false );

		// Animate
		animate.call( this );

	}

	PANOLENS.Viewer.prototype = {

		constructor : PANOLENS.Viewer,

		control : {},

		add : function ( object ) {

			if ( arguments.length > 1 ) {

				for ( var i = 0; i < arguments.length; i ++ ) {

					this.add( arguments[ i ] );

				}

				return this;

			}

			scene.add( object );

			// All object added to scene has 'panolens-viewer-handler' event to handle viewer communication
			if ( object.addEventListener ) {

				object.addEventListener( 'panolens-viewer-handler', this.eventHandler.bind( this ) );

			}

			if ( object.type === 'panorama' ) {

				this.addPanoramaEventListener( object );

				if ( !panorama ) {

					this.setPanorama( object );

				}

			}


		},

		setPanorama : function ( pano ) {

			if ( pano.type === 'panorama' ) {
				
				// Reset Current Panorama
				panorama && panorama.onLeave();

				// Assign and enter panorama
				( panorama = pano ).onEnter();
				
			}

		},

		eventHandler : function ( event ) {

			if ( event.method && this[ event.method ] ) {

				this[ event.method ]( event.data );

			}

		},

		toggleVideoPlay: function () {

			if ( panorama instanceof PANOLENS.VideoPanorama ) {

				panorama.dispatchEvent( { type: 'video-toggle' } );

			}

		},

		setVideoCurrentTime: function ( percentage ) {

			if ( panorama instanceof PANOLENS.VideoPanorama ) {

				panorama.dispatchEvent( { type: 'video-time', percentage: percentage } );

			}

		},

		onVideoUpdate: function ( percentage ) {

			widget && widget.dispatchEvent( { type: 'video-update', percentage: percentage } );

		},

		addRenderableObject : function ( object ) {

			if ( object ) {

				renderableObjectList.push( object );

			}

		},

		showVideoWidget: function () {

			widget && widget.dispatchEvent( { type: 'video-control-show' } );

		},

		hideVideoWidget: function () {

			widget && widget.dispatchEvent( { type: 'video-control-hide' } );

		},

		addPanoramaEventListener: function ( pano ) {

			// Every panorama
			pano.addEventListener( 'enter-start', this.setCameraControl );

			// VideoPanorama
			if ( pano instanceof PANOLENS.VideoPanorama ) {

				pano.addEventListener( 'enter', this.showVideoWidget );
				pano.addEventListener( 'leave', this.hideVideoWidget );

			}


		},

		setCameraControl: function () {

			camera.position.copy( panorama.position );
			camera.position.z -= 1;
			OrbitControls.target.copy( panorama.position );

		},

		getControl: function () {

			return this.control;

		},

		getScene : function () {

			return scene;

		},

		getCamera : function () {

			return camera;

		},

		getRenderer : function () {

			return renderer;

		},

		getControlName : function () {

			return this.control.name;

		},

		getNextControlName : function () {

			return controls[ this.getNextControlIndex() ].name;

		},

		getNextControlIndex : function () {

			return ( controls.indexOf( this.control ) + 1 >= controls.length ) ? 0 : controls.indexOf( this.control ) + 1;

		},

		enableControl : function ( index ) {

			index = ( index >= 0 && index < controls.length ) ? index : 0;

			this.control.enabled = false;

			this.control = controls[ index ];

			this.control.enabled = true;

			switch ( this.control.name ) {
				case 'orbit':
					camera.position.copy( panorama.position );
					camera.position.z -= panorama.orbitRadius / 2;
					break;
				case 'device-orientation':
					camera.position.copy( panorama.position );
					break;
				default:
					break;
			}

		},

		toggleNextControl : function () {

			this.enableControl( this.getNextControlIndex() );

		},

		onWindowResize : function () {

			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();

			renderer.setSize( window.innerWidth, window.innerHeight );
		},

		render : function () {

			if ( renderableObjectList.length > 0 ) {

				for( var i = 0 ; i < renderableObjectList.length ; i++ ) {

					if ( renderableObjectList[i].update ) {
					
						renderableObjectList[i].update();
					
					}

				}

			}

			TWEEN.update();

			if ( this.control ) {

				this.control.update();

			}

			if ( scene && camera ) {

				renderer.render( scene, camera );

			}
		}

	};

	function select ( event, isSelect ) {

		var point = {}, object, intersects;

		point.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		point.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

		raycaster.setFromCamera( point, camera );

		if ( !panorama ) { return; }

		// For Adding Infospot
		if ( DEBUG ) {

			intersects = raycaster.intersectObject( panorama, true );

			if ( intersects.length > 0 ) {

				intersects[0].point.applyAxisAngle( new THREE.Vector3( -1, 0, 0 ), panorama.rotation.x );
				intersects[0].point.applyAxisAngle( new THREE.Vector3( 0, -1, 0 ), panorama.rotation.y );
				intersects[0].point.applyAxisAngle( new THREE.Vector3( 0, 0, -1 ), panorama.rotation.z );

				intersects[0].point.sub( panorama.position );

				console.info('{ ' + (-intersects[0].point.x).toFixed(2) + 
					', ' + (intersects[0].point.y).toFixed(2) +
					', ' + (intersects[0].point.z).toFixed(2) + ' }'
				);

			}
			
		}

		intersects = raycaster.intersectObjects( panorama.children, true );

		if ( isSelect ) {

			panorama.dispatchEvent( { type: 'click', intersects: intersects, mouseEvent: event } );

		}

		if ( intersects.length > 0 ) {

			object = intersects[ 0 ].object;

			if ( object.onHover ) {

				hoveringObject = object;

				container.style.cursor = 'pointer';

				object.onHover( event.clientX, event.clientY );

			}

			if ( isSelect && object.onClick ) {

				object.onClick();

				return true;

			}

		} else {

			container.style.cursor = 'default';

			hideHoveringObject();

		}

	}

	function onMouseDown ( event ) {

		event.preventDefault();

		userMouse.x = ( event.clientX ) ? event.clientX : event.touches[0].clientX;
		userMouse.y = ( event.clientY ) ? event.clientY : event.touches[0].clientY;

	}

	function onMouseMove ( event ) {

		event.preventDefault();
		select( event );

	}

	function onMouseUp ( event ) {

		var onTarget = false, isClick = false;

		isClick = ( userMouse.x === event.clientX && userMouse.y === event.clientY ) || 
			( event.changedTouches && 
			userMouse.x === event.changedTouches[0].clientX && 
			userMouse.y === event.changedTouches[0].clientY );

		// Event should happen on canvas
		if ( event && event.target && !event.target.classList.contains( 'panolens-canvas' ) ) { return; }

		event.preventDefault();

		if ( event.changedTouches && event.changedTouches.length === 1 ) {

			onTarget = select( { clientX : event.changedTouches[0].clientX, clientY : event.changedTouches[0].clientY }, isClick );
		
		} else {

			onTarget = select( event, isClick );

		}

		if ( onTarget ) { 

			return; 

		}

		if ( isClick ) {

			panorama && panorama.toggleChildrenVisibility();
			toggleControlBar();

		}

	}

	function hideHoveringObject () {

		if ( hoveringObject ) {

			hoveringObject.onHoverEnd();

			hoveringObject = undefined;

		}

	}

	function toggleControlBar () {

		widget && widget.dispatchEvent( { type: 'control-bar-toggle' } );

	}

	function onKeyDown ( event ) {

		if ( event.keyCode === 17 || event.keyIdentifier === 'Control' ) {

			DEBUG = true;

		}

	}

	function onKeyUp () {

		DEBUG = false;

	}

	function animate(){

        window.requestAnimationFrame( animate.bind( this ) );

        this.render();

    }

} )();