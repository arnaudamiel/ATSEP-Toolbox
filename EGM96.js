class EGM96Loader {
    constructor() {
        this.grid = null;
        this.rows = 721;
        this.cols = 1441;
    }

    async load(url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Could not find " + url);
        // Fetch as ArrayBuffer to check magic bytes
        const buffer = await resp.arrayBuffer();
        const view = new Uint8Array(buffer);
        let text;

        // Check for gzip magic numbers: 0x1F, 0x8B
        if (view.length >= 2 && view[0] === 0x1F && view[1] === 0x8B && typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('gzip');
            const stream = new Response(buffer).body.pipeThrough(ds);
            text = await new Response(stream).text();
        } else {
            // Either not gzipped (server auto-decompressed) or browser doesn't support DecompressionStream
            text = new TextDecoder().decode(buffer);
        }

        // Parse ASCII grid file
        const lines = text.split(/\r?\n/);

        // Skip header line and parse values
        this.grid = [];
        let valueIndex = 0;

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].trim().split(/\s+/).filter(v => v.length > 0);
            for (let v of values) {
                const num = parseFloat(v);
                if (!isNaN(num)) {
                    this.grid.push(num);
                }
            }
        }

        return true;
    }

    getN(lat, lon) {
        if (!this.grid) return 0;

        let loni = lon < 0 ? lon + 360 : lon;
        let lati = 90 - lat;

        let row0 = Math.floor(lati / 0.25);
        let col0 = Math.floor(loni / 0.25);

        // Clamp rows
        row0 = Math.max(0, Math.min(row0, this.rows - 2));

        // Wrap columns
        let col1 = (col0 + 1) % (this.cols - 1);

        // Bilinear interpolation weights
        let xFrac = (loni / 0.25) - col0;
        let yFrac = (lati / 0.25) - row0;

        const v00 = this._read(row0, col0);
        const v01 = this._read(row0, col1);
        const v10 = this._read(row0 + 1, col0);
        const v11 = this._read(row0 + 1, col1);

        const top = v00 + xFrac * (v01 - v00);
        const bot = v10 + xFrac * (v11 - v10);
        return top + yFrac * (bot - top);
    }

    _read(r, c) {
        // Read from flat array using row-major order
        return this.grid[r * this.cols + c];
    }
}