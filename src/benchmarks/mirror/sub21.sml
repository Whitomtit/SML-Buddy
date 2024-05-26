
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => t
  | Node (n, x, y) => Node (n, mirror y, mirror x)

