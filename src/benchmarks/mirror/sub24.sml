
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (a, Empty, Empty) => t
  | Node (a, Empty, right) => Node (a, mirror right, Empty)
  | Node (a, left, Empty) => Node (a, Empty, mirror left)
  | Node (a, left, right) => Node (a, mirror right, mirror left)

