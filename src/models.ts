export type Node = {
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    selected?: boolean,
    label?: string,
    selectionColor: string,
    color: string,
}


export type Connection = {
    id: number,
    from: Node,
    to: Node,
    isTemporary: boolean,
    selected: boolean,
    selectionColor: string,
}

export type Point = {
    x: number,
    y: number,
}


export type NodeType = 'type-1' | 'type-2' | 'type-3' | 'type-4';