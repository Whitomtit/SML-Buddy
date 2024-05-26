
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (i, b1, b2) => Node (i, mirror b2, mirror b1)

