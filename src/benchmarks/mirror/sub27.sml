
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (root, left, right) => Node (root, mirror right, mirror left)

