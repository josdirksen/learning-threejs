var CTM = CTM || {};

CTM.CompressionMethod = {
    RAW: 0x00574152,
    MG1: 0x0031474d,
    MG2: 0x0032474d
};

CTM.Flags = {
    NORMALS: 0x00000001
};

CTM.File = function(stream){
    this.load(stream);
};

CTM.File.prototype.load = function(stream){
    this.header = new CTM.FileHeader(stream);

    this.body = new CTM.FileBody(this.header);

    this.getReader().read(stream, this.body);
};

CTM.File.prototype.getReader = function(){
    var reader;

    switch(this.header.compressionMethod){
        case CTM.CompressionMethod.RAW:
            reader = new CTM.ReaderRAW();
            break;
        case CTM.CompressionMethod.MG1:
            reader = new CTM.ReaderMG1();
            break;
        case CTM.CompressionMethod.MG2:
            reader = new CTM.ReaderMG2();
            break;
    }

    return reader;
};

CTM.FileHeader = function(stream){
    stream.readInt32(); //magic "OCTM"
    this.fileFormat = stream.readInt32();
    this.compressionMethod = stream.readInt32();
    this.vertexCount = stream.readInt32();
    this.triangleCount = stream.readInt32();
    this.uvMapCount = stream.readInt32();
    this.attrMapCount = stream.readInt32();
    this.flags = stream.readInt32();
    this.comment = stream.readString();
};

CTM.FileHeader.prototype.hasNormals = function(){
    return this.flags & CTM.Flags.NORMALS;
};

CTM.FileBody = function(header){
    var i = header.triangleCount * 3,
        v = header.vertexCount * 3,
        n = header.hasNormals()? header.vertexCount * 3: 0,
        u = header.vertexCount * 2,
        a = header.vertexCount * 4,
        j = 0;

    var data = new ArrayBuffer(
        (i + v + n + (u * header.uvMapCount) + (a * header.attrMapCount) ) * 4);

    this.indices = new Uint32Array(data, 0, i);

    this.vertices = new Float32Array(data, i * 4, v);

    if ( header.hasNormals() ){
        this.normals = new Float32Array(data, (i + v) * 4, n);
    }

    if (header.uvMapCount){
        this.uvMaps = [];
        for (j = 0; j < header.uvMapCount; ++ j){
            this.uvMaps[j] = {uv: new Float32Array(data,
                (i + v + n + (j * u) ) * 4, u) };
        }
    }

    if (header.attrMapCount){
        this.attrMaps = [];
        for (j = 0; j < header.attrMapCount; ++ j){
            this.attrMaps[j] = {attr: new Float32Array(data,
                (i + v + n + (u * header.uvMapCount) + (j * a) ) * 4, a) };
        }
    }
};

CTM.FileMG2Header = function(stream){
    stream.readInt32(); //magic "MG2H"
    this.vertexPrecision = stream.readFloat32();
    this.normalPrecision = stream.readFloat32();
    this.lowerBoundx = stream.readFloat32();
    this.lowerBoundy = stream.readFloat32();
    this.lowerBoundz = stream.readFloat32();
    this.higherBoundx = stream.readFloat32();
    this.higherBoundy = stream.readFloat32();
    this.higherBoundz = stream.readFloat32();
    this.divx = stream.readInt32();
    this.divy = stream.readInt32();
    this.divz = stream.readInt32();

    this.sizex = (this.higherBoundx - this.lowerBoundx) / this.divx;
    this.sizey = (this.higherBoundy - this.lowerBoundy) / this.divy;
    this.sizez = (this.higherBoundz - this.lowerBoundz) / this.divz;
};

CTM.ReaderRAW = function(){
};

CTM.ReaderRAW.prototype.read = function(stream, body){
    this.readIndices(stream, body.indices);
    this.readVertices(stream, body.vertices);

    if (body.normals){
        this.readNormals(stream, body.normals);
    }
    if (body.uvMaps){
        this.readUVMaps(stream, body.uvMaps);
    }
    if (body.attrMaps){
        this.readAttrMaps(stream, body.attrMaps);
    }
};

CTM.ReaderRAW.prototype.readIndices = function(stream, indices){
    stream.readInt32(); //magic "INDX"
    stream.readArrayInt32(indices);
};

CTM.ReaderRAW.prototype.readVertices = function(stream, vertices){
    stream.readInt32(); //magic "VERT"
    stream.readArrayFloat32(vertices);
};

CTM.ReaderRAW.prototype.readNormals = function(stream, normals){
    stream.readInt32(); //magic "NORM"
    stream.readArrayFloat32(normals);
};

CTM.ReaderRAW.prototype.readUVMaps = function(stream, uvMaps){
    for (var i = 0; i < uvMaps.length; ++ i){
        stream.readInt32(); //magic "TEXC"

        uvMaps[i].name = stream.readString();
        uvMaps[i].filename = stream.readString();
        stream.readArrayFloat32(uvMaps[i].uv);
    }
};

CTM.ReaderRAW.prototype.readAttrMaps = function(stream, attrMaps){
    for (var i = 0; i < attrMaps.length; ++ i){
        stream.readInt32(); //magic "ATTR"

        attrMaps[i].name = stream.readString();
        stream.readArrayFloat32(attrMaps[i].attr);
    }
};

CTM.ReaderMG1 = function(){
};

CTM.ReaderMG1.prototype.read = function(stream, body){
    this.readIndices(stream, body.indices);
    this.readVertices(stream, body.vertices);

    if (body.normals){
        this.readNormals(stream, body.normals);
    }
    if (body.uvMaps){
        this.readUVMaps(stream, body.uvMaps);
    }
    if (body.attrMaps){
        this.readAttrMaps(stream, body.attrMaps);
    }
};

CTM.ReaderMG1.prototype.readIndices = function(stream, indices){
    stream.readInt32(); //magic "INDX"
    stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(indices, 3);
    LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

    CTM.restoreIndices(indices, indices.length);
};

CTM.ReaderMG1.prototype.readVertices = function(stream, vertices){
    stream.readInt32(); //magic "VERT"
    stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(vertices, 1);
    LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
};

CTM.ReaderMG1.prototype.readNormals = function(stream, normals){
    stream.readInt32(); //magic "NORM"
    stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(normals, 3);
    LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
};

CTM.ReaderMG1.prototype.readUVMaps = function(stream, uvMaps){
    for (var i = 0; i < uvMaps.length; ++ i){
        stream.readInt32(); //magic "TEXC"

        uvMaps[i].name = stream.readString();
        uvMaps[i].filename = stream.readString();

        stream.readInt32(); //packed size

        var interleaved = new CTM.InterleavedStream(uvMaps[i].uv, 2);
        LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
    }
};

CTM.ReaderMG1.prototype.readAttrMaps = function(stream, attrMaps){
    for (var i = 0; i < attrMaps.length; ++ i){
        stream.readInt32(); //magic "ATTR"

        attrMaps[i].name = stream.readString();

        stream.readInt32(); //packed size

        var interleaved = new CTM.InterleavedStream(attrMaps[i].attr, 4);
        LZMA.decompress(stream, stream, interleaved, interleaved.data.length);
    }
};

CTM.ReaderMG2 = function(){
};

CTM.ReaderMG2.prototype.read = function(stream, body){
    this.MG2Header = new CTM.FileMG2Header(stream);

    this.readVertices(stream, body.vertices);
    this.readIndices(stream, body.indices);

    if (body.normals){
        this.readNormals(stream, body);
    }
    if (body.uvMaps){
        this.readUVMaps(stream, body.uvMaps);
    }
    if (body.attrMaps){
        this.readAttrMaps(stream, body.attrMaps);
    }
};

CTM.ReaderMG2.prototype.readVertices = function(stream, vertices){
    stream.readInt32(); //magic "VERT"
    stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(vertices, 3);
    LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

    var gridIndices = this.readGridIndices(stream, vertices);

    CTM.restoreVertices(vertices, this.MG2Header, gridIndices, this.MG2Header.vertexPrecision);
};

CTM.ReaderMG2.prototype.readGridIndices = function(stream, vertices){
    stream.readInt32(); //magic "GIDX"
    stream.readInt32(); //packed size

    var gridIndices = new Uint32Array(vertices.length / 3);

    var interleaved = new CTM.InterleavedStream(gridIndices, 1);
    LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

    CTM.restoreGridIndices(gridIndices, gridIndices.length);

    return gridIndices;
};

CTM.ReaderMG2.prototype.readIndices = function(stream, indices){
    stream.readInt32(); //magic "INDX"
    stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(indices, 3);
    LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

    CTM.restoreIndices(indices, indices.length);
};

CTM.ReaderMG2.prototype.readNormals = function(stream, body){
    stream.readInt32(); //magic "NORM"
    stream.readInt32(); //packed size

    var interleaved = new CTM.InterleavedStream(body.normals, 3);
    LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

    var smoothNormals = CTM.calcSmoothNormals(body.indices, body.vertices);

    CTM.restoreNormals(body.normals, smoothNormals, this.MG2Header.normalPrecision);
};

CTM.ReaderMG2.prototype.readUVMaps = function(stream, uvMaps){
    for (var i = 0; i < uvMaps.length; ++ i){
        stream.readInt32(); //magic "TEXC"

        uvMaps[i].name = stream.readString();
        uvMaps[i].filename = stream.readString();

        var precision = stream.readFloat32();

        stream.readInt32(); //packed size

        var interleaved = new CTM.InterleavedStream(uvMaps[i].uv, 2);
        LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

        CTM.restoreMap(uvMaps[i].uv, 2, precision);
    }
};

CTM.ReaderMG2.prototype.readAttrMaps = function(stream, attrMaps){
    for (var i = 0; i < attrMaps.length; ++ i){
        stream.readInt32(); //magic "ATTR"

        attrMaps[i].name = stream.readString();

        var precision = stream.readFloat32();

        stream.readInt32(); //packed size

        var interleaved = new CTM.InterleavedStream(attrMaps[i].attr, 4);
        LZMA.decompress(stream, stream, interleaved, interleaved.data.length);

        CTM.restoreMap(attrMaps[i].attr, 4, precision);
    }
};

CTM.restoreIndices = function(indices, len){
    if (len > 0){
        indices[2] += indices[0];
    }
    for (var i = 3; i < len; i += 3){
        indices[i] += indices[i - 3];

        if (indices[i] === indices[i - 3]){
            indices[i + 1] += indices[i - 2];
        }else{
            indices[i + 1] += indices[i];
        }

        indices[i + 2] += indices[i];
    }
};

CTM.restoreGridIndices = function(gridIndices, len){
    for (var i = 1; i < len; ++ i){
        gridIndices[i] += gridIndices[i - 1];
    }
};

CTM.restoreVertices = function(vertices, grid, gridIndices, precision){
    var verticesIndices = new Uint32Array(vertices.buffer, vertices.byteOffset),
        gridOrigin = [], gridIdx, delta, prevGridIndex = 0x7fffffff, prevDelta = 0;

    for (var i = 0, j = 0; i < gridIndices.length; ++ i, j += 3){
        gridIdx = gridIndices[i];

        CTM.gridIdxToPoint(grid, gridIdx, gridOrigin);

        delta = verticesIndices[j];
        if (gridIdx === prevGridIndex){
            delta += prevDelta;
        }

        vertices[j]     = gridOrigin[0] + precision * delta;
        vertices[j + 1] = gridOrigin[1] + precision * verticesIndices[j + 1];
        vertices[j + 2] = gridOrigin[2] + precision * verticesIndices[j + 2];

        prevGridIndex = gridIdx;
        prevDelta = delta;
    }
};

CTM.restoreNormals = function(normals, smoothNormals, precision){
    var intNormals = new Uint32Array(normals.buffer, normals.byteOffset),
        n = [], basis = [], magn, intPhi, phi, thetaScale, theta, sinPhi;

    for (var i = 0; i < normals.length; i += 3){
        magn = intNormals[i] * precision;

        intPhi = intNormals[i + 1];

        if (intPhi === 0){
            theta = - Math.PI;
        }else{
            if (intPhi <= 4){
                thetaScale = 0.5;
            }else{
                thetaScale = 2.0 / intPhi;
            }
            theta = (intNormals[i + 2] * thetaScale - 1) * Math.PI;
        }

        phi = intPhi * 0.5 * Math.PI * precision;

        sinPhi = Math.sin(phi);

        n[0] = sinPhi * Math.cos(theta) * magn;
        n[1] = sinPhi * Math.sin(theta) * magn;
        n[2] = Math.cos(phi) * magn;

        CTM.makeNormalCoordSys(smoothNormals, i, basis);

        normals[i]     = basis[0] * n[0] + basis[3] * n[1] + basis[6] * n[2];
        normals[i + 1] = basis[1] * n[0] + basis[4] * n[1] + basis[7] * n[2];
        normals[i + 2] = basis[2] * n[0] + basis[5] * n[1] + basis[8] * n[2];
    }
};

CTM.restoreMap = function(map, count, precision){
    var mapIndices = new Uint32Array(map.buffer, map.byteOffset),
        delta, value;

    for (var i = 0; i < count; ++ i){
        delta = 0;

        for (var j = i; j < map.length; j += count){
            value = mapIndices[j];

            delta += value & 1? -( (value + 1) >> 1): value >> 1;

            map[j] = delta * precision;
        }
    }
};

CTM.gridIdxToPoint = function(grid, gridIdx, gridOrigin){
    var zdiv = grid.divx * grid.divy,
        ydiv = grid.divx,
        point = [];

    point[2] = ~~(gridIdx / zdiv);

    gridIdx -= ~~(point[2] * zdiv);
    point[1] = ~~(gridIdx / ydiv);

    gridIdx -= ~~(point[1] * ydiv);
    point[0] = gridIdx;

    gridOrigin[0] = grid.lowerBoundx + point[0] * grid.sizex;
    gridOrigin[1] = grid.lowerBoundy + point[1] * grid.sizey;
    gridOrigin[2] = grid.lowerBoundz + point[2] * grid.sizez;
};

CTM.calcSmoothNormals = function(indices, vertices){
    var smoothNormals = new Float32Array(vertices.length),
        tri = [], v1 = [], v2 = [], n = [], len, i, j;

    for (i = 0; i < indices.length; i += 3){
        tri[0] = indices[i]     * 3;
        tri[1] = indices[i + 1] * 3;
        tri[2] = indices[i + 2] * 3;

        for (j = 0; j < 3; ++ j){
            v1[j] = vertices[ tri[1] + j] - vertices[ tri[0] + j];
            v2[j] = vertices[ tri[2] + j] - vertices[ tri[0] + j];
        }

        n[0] = v1[1] * v2[2] - v1[2] * v2[1];
        n[1] = v1[2] * v2[0] - v1[0] * v2[2];
        n[2] = v1[0] * v2[1] - v1[1] * v2[0];

        len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
        if (len > 1e-10){
            len = 1.0 / len;

            n[0] *= len;
            n[1] *= len;
            n[2] *= len;
        }

        for (j = 0; j < 3; ++ j){
            smoothNormals[ tri[j] ]    += n[0];
            smoothNormals[ tri[j] + 1] += n[1];
            smoothNormals[ tri[j] + 2] += n[2];
        }
    }

    for (i = 0; i < smoothNormals.length; i += 3){
        len = Math.sqrt(smoothNormals[i] * smoothNormals[i] +
            smoothNormals[i + 1] * smoothNormals[i + 1] +
            smoothNormals[i + 2] * smoothNormals[i + 2]);

        if(len > 1e-10){
            len = 1.0 / len;

            smoothNormals[i]     *= len;
            smoothNormals[i + 1] *= len;
            smoothNormals[i + 2] *= len;
        }
    }

    return smoothNormals;
};

CTM.makeNormalCoordSys = function(normals, index, basis){
    basis[0] = - normals[index + 1];
    basis[1] = normals[index] - normals[index + 2];
    basis[2] = normals[index + 1];

    var len = Math.sqrt(2.0 * basis[0] * basis[0] + basis[1] * basis[1]);
    if (len > 1e-10){
        len = 1.0 / len;

        basis[0] *= len;
        basis[1] *= len;
        basis[2] *= len;
    }

    basis[6] = normals[index];
    basis[7] = normals[index + 1];
    basis[8] = normals[index + 2];

    basis[3] = basis[7] * basis[2] - basis[8] * basis[1];
    basis[4] = basis[8] * basis[0] - basis[6] * basis[2];
    basis[5] = basis[6] * basis[1] - basis[7] * basis[0];
};

CTM.isLittleEndian = (function(){
    var buffer = new ArrayBuffer(2),
        bytes = new Uint8Array(buffer),
        ints = new Uint16Array(buffer);

    bytes[0] = 1;

    return ints[0] === 1;
}());

CTM.InterleavedStream = function(data, count){
    this.data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    this.offset = CTM.isLittleEndian? 3: 0;
    this.count = count * 4;
};

CTM.InterleavedStream.prototype.writeByte = function(value){
    this.data[this.offset] = value;

    this.offset += this.count;
    if (this.offset >= this.data.length){

        this.offset -= this.data.length - 4;
        if (this.offset >= this.count){

            this.offset -= this.count + (CTM.isLittleEndian? 1: -1);
        }
    }
};

CTM.Stream = function(data){
    this.data = data;
    this.offset = 0;
};

CTM.Stream.prototype.TWO_POW_MINUS23 = (function(){
    return Math.pow(2, -23);
}());

CTM.Stream.prototype.TWO_POW_MINUS126 = (function(){
    return Math.pow(2, -126);
}());

CTM.Stream.prototype.readByte = function(){
    return this.data.charCodeAt(this.offset ++) & 0xff;
};

CTM.Stream.prototype.readInt32 = function(){
    var i = this.readByte();
    i |= this.readByte() << 8;
    i |= this.readByte() << 16;
    return i | (this.readByte() << 24);
};

CTM.Stream.prototype.readFloat32 = function(){
    var m = this.readByte();
    m += this.readByte() << 8;

    var b1 = this.readByte();
    var b2 = this.readByte();

    m += (b1 & 0x7f) << 16;
    var e = ( (b2 & 0x7f) << 1) | ( (b1 & 0x80) >>> 7);
    var s = b2 & 0x80? -1: 1;

    if (e === 255){
        return m !== 0? NaN: s * Infinity;
    }
    if (e > 0){
        return s * (1 + (m * this.TWO_POW_MINUS23) ) * Math.pow(2, e - 127);
    }
    if (m !== 0){
        return s * m * this.TWO_POW_MINUS126;
    }
    return s * 0;
};

CTM.Stream.prototype.readString = function(){
    var len = this.readInt32();

    this.offset += len;

    return this.data.substr(this.offset - len, len);
};

CTM.Stream.prototype.readArrayInt32 = function(array){
    var len = array.length;

    for (var i = 0; i < len; ++ i){
        array[i] = this.readInt32();
    }

    return array;
};

CTM.Stream.prototype.readArrayFloat32 = function(array){
    var len = array.length;

    for (var i = 0; i < len; ++ i){
        array[i] = this.readFloat32();
    }

    return array;
};
