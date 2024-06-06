
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (a, left, right) => Node (a, mirror right, mirror left)

