
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (l, v, r) => Node (l, mirror r, mirror v)

