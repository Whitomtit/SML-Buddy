
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (x, left, right) => Node (x, mirror right, mirror left)

