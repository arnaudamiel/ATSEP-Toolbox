class EGM96Loader {
    constructor() {
        this.grid = null;
        this.rows = 721;
        this.cols = 1441;
    }

    async load(url, onProgress) {
        try {
            onProgress?.('loading');
            const resp = await fetch(url);
            if (!resp.ok) throw new Error("Could not find " + url);

            // Fetch as stream for decompression
            const ds = new DecompressionStream('gzip');
            const decompressed = resp.body.pipeThrough(ds);
            const reader = decompressed.getReader();
            const chunks = [];
            const decoder = new TextDecoder();
            let text = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode(); // final flush

            // Parse ASCII grid file
            const lines = text.split(/\r?\n/);

            // Skip header line and parse values
            this.grid = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].trim().split(/\s+/).filter(v => v.length > 0);
                for (let v of values) {
                    const num = parseFloat(v);
                    if (!isNaN(num)) {
                        this.grid.push(num);
                    }
                }
            }

            onProgress?.('ready');
            return true;
        } catch (err) {
            onProgress?.('error', err.message);
            throw err;
        }
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