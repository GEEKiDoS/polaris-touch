export class SpiceConnection {
    _socket: WebSocket | null;
    _statusElement = document.querySelector<HTMLDivElement>("#connection");
    _serverElement = document.querySelector<HTMLDivElement>("#server");
    _id = 0;

    constructor(private readonly _host: string) {
        this._socket = new WebSocket(_host);
        this.setServer(_host);

        this._socket.onopen = () => {
            this.setStatus("CONNECTED");
        };

        this._socket.onerror = () => {
            this.setStatus("ERROR");
            this.disconnect();
        };

        this._socket.onclose = () => {
            this.setStatus("CLOSED");
            this.setServer("<NONE>");

            this._socket = null;
        };
    }

    private setServer(server: string) {
        if (this._serverElement) {
            this._serverElement.innerText = server;
        }
    }

    private setStatus(status: string) {
        if (this._statusElement) {
            this._statusElement.innerText = status;
        }
    }

    send(command: object) {
        if (!this._socket) {
            return;
        }

        const packet = new TextEncoder().encode(JSON.stringify(command) + '\0');
        this._socket.send(packet);
    }

    disconnect() {
        this._socket?.close();
    }

    get valid() {
        return !!this._socket;
    }

    get connected() {
        return this._socket?.readyState == WebSocket.OPEN;
    }

    get host() {
        return this._host;
    }

    get id() {
        return this._id++;
    }
}
