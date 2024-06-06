
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (num, b1, b2) => Node (num, mirror b2, mirror b1)

