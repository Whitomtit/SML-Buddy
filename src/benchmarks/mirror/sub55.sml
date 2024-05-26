
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (a, b, c) => Node (a, mirror c, mirror b)

