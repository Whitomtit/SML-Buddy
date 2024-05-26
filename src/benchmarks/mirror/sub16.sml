
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Node (a, b, c) => Node (a, mirror c, mirror b)
  | _ => Empty

