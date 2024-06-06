
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (i, left, right) => Node (i, mirror right, mirror left)

