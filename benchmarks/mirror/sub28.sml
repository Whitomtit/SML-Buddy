
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (i, x, y) => Node (i, mirror y, mirror x)

