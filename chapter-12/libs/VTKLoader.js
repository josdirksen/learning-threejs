/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.VTKLoader = function () {};

THREE.VTKLoader.prototype = {

    constructor: THREE.VTKLoader,

    addEventListener: THREE.EventDispatcher.prototype.addEventListener,
    hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
    removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
    dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,

    load: function ( url, callback ) {

        var scope = this;
        var request = new XMLHttpRequest();

        request.addEventListener( 'load', function ( event ) {

            var geometry = scope.parse( event.target.responseText );

            scope.dispatchEvent( { type: 'load', content: geometry } );

            if ( callback ) callback( geometry );

        }, false );

        request.addEventListener( 'progress', function ( event ) {

            scope.dispatchEvent( { type: 'progress', loaded: event.loaded, total: event.total } );

        }, false );

        request.addEventListener( 'error', function () {

            scope.dispatchEvent( { type: 'error', message: 'Couldn\'t load URL [' + url + ']' } );

        }, false );

        request.open( 'GET', url, true );
        request.send( null );

    },

    parse: function ( data ) {

        var geometry = new THREE.Geometry();

        function vertex( x, y, z ) {

            geometry.vertices.push( new THREE.Vector3( x, y, z ) );

        }

        function face3( a, b, c ) {

            geometry.faces.push( new THREE.Face3( a, b, c ) );

        }

        function face4( a, b, c, d ) {

            geometry.faces.push( new THREE.Face4( a, b, c, d ) );

        }

        var pattern, result;

        // float float float

        pattern = /([\+|\-]?[\d]+[\.][\d|\-|e]+)[ ]+([\+|\-]?[\d]+[\.][\d|\-|e]+)[ ]+([\+|\-]?[\d]+[\.][\d|\-|e]+)/g;

        while ( ( result = pattern.exec( data ) ) != null ) {

            // ["1.0 2.0 3.0", "1.0", "2.0", "3.0"]

            vertex( parseFloat( result[ 1 ] ), parseFloat( result[ 2 ] ), parseFloat( result[ 3 ] ) );

        }

        // 3 int int int

        pattern = /3[ ]+([\d]+)[ ]+([\d]+)[ ]+([\d]+)/g;

        while ( ( result = pattern.exec( data ) ) != null ) {

            // ["3 1 2 3", "1", "2", "3"]

            face3( parseInt( result[ 1 ] ), parseInt( result[ 2 ] ), parseInt( result[ 3 ] ) );

        }

        // 4 int int int int

        pattern = /4[ ]+([\d]+)[ ]+([\d]+)[ ]+([\d]+)[ ]+([\d]+)/g;

        while ( ( result = pattern.exec( data ) ) != null ) {

            // ["4 1 2 3 4", "1", "2", "3", "4"]

            face4( parseInt( result[ 1 ] ), parseInt( result[ 2 ] ), parseInt( result[ 3 ] ), parseInt( result[ 4 ] ) );

        }

        //geometry.computeCentroids();
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        return geometry;

    }

}; 