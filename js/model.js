// Geschiedenis voor ongedaan maken en opnieuw. Een snapshot is een kopie van de lagenlijst.
// Streken worden nooit in-place aangepast (er komt altijd een nieuwe array), dus snapshots
// kunnen ze veilig delen.
export class History {
  constructor(limit = 100) {
    this.limit = limit;
    this.reset(null);
  }

  reset(snapshot) {
    this.past = [];
    this.future = [];
    this.current = snapshot;
  }

  push(snapshot) {
    if (this.current !== null) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.current = snapshot;
    this.future = [];
  }

  undo() {
    if (!this.past.length) return null;
    this.future.push(this.current);
    this.current = this.past.pop();
    return this.current;
  }

  redo() {
    if (!this.future.length) return null;
    this.past.push(this.current);
    this.current = this.future.pop();
    return this.current;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}

// Ondiepe kopie per laag: lagen zijn platte objecten en arrays worden nooit in-place gewijzigd.
export const copyLayers = (layers) => layers.map((l) => ({ ...l }));
