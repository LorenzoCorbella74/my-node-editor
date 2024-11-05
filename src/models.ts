export type Node = {
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    selected?: boolean,
    label?: string,
}


export type Connection = {
    id: string,
    from: Node,
    to: Node,
    isTemporary: boolean,
    selected: boolean,
}

export type Point = {
    x: number,
    y: number,
}