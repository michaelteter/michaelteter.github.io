defmodule K20.GenUserStats do
  alias K20.{Repo, UserStats, Order, User, Times}
  require Logger
  import Ecto.Query

  def reset_user_stats_table() do
    Ecto.Adapters.SQL.query!(Repo, "delete from user_stats")
    Ecto.Adapters.SQL.query!(Repo, "alter sequence user_stats_id_seq restart 1")
  end

  def get_paid_orders_by_user_id_dict() do
    true
  end

  def qual_date_str(qual_date), do: if is_nil(qual_date), do: "", else: Times.pretty_cst_ts(qual_date)

  def init_paid_at(paid_at), do: if is_nil(paid_at), do: nil, else: Times.pretty_cst_ts(paid_at)

  def default_stat_data(u) do
    %{paid:         u.paid_member,
      paid_at:      init_paid_at(u.paid_at),
      lpaid:        false,
      rpaid:        false,
      qual:         !is_nil(u.qual2),
      qual1:        qual_date_str(u.qual1),
      qual2:        qual_date_str(u.qual2),
      qual3:        qual_date_str(u.qual3),
      mship_abbrev: "",
      depth:        -1,
      refcode:      u.refcode,
      name:         u.name,
      sname:        "",
      pname:        "",
      initials:     "",
      sinitials:    "",
      pinitials:    "",
      email:        u.email,
      semail:       "",
      pemail:       "",
      phone:        u.phone,
      sphone:       "",
      pphone:       "",
      join_date:    K20.Times.pretty_cst_ts(u.inserted_at),
      bin_lcount:   0,
      bin_rcount:   0,
      uni_lcount:   0,
      uni_rcount:   0,
      dvol_old:     0,
      lvol_old:     0,
      rvol_old:     0,
      dvol_new:     0,
      lvol_new:     0,
      rvol_new:     0,
      n_refs:       0,
      n_paid_refs:  0,
      n_qual_refs:  0,
      dropside:     u.dropside}
  end

  def default_stat(u) do
    %{uid:      u.id,
      sid:      u.sid,
      sside:    "?",
      pid:      u.pid,
      pside:    u.side,
      lid:      nil,
      rid:      nil,
      siterole: u.siterole,
      llid:     nil,
      rrid:     nil,
      data:     default_stat_data(u),
      inserted_at: nil}
  end

  def pregen_stats(users) do
    for u <- users, into: %{}, do: {u.id, default_stat(u)}
  end

  def get_order_ids_by_user_id(orders) do
    orders
    |> Enum.group_by(fn o -> o.user_id end,
                     fn o -> o.id end)
  end

  def get_orders() do
    from(o in Order,
         where: o.is_paid == true,
         select: [:id, :is_paid, :user_id, :membership_id])
    |> Repo.all()
  end

  def get_orders_by_id(orders) do
    Map.new(orders, fn o -> {o.id, o} end)
  end

  def get_memberships_by_abbrev(memberships_by_id) do
    memberships_by_id
    |> Map.new(fn {_k, v} -> {v.abbrev, v} end)
  end

  def paid_orders() do
    Repo.all(from o in Order,
             where: o.is_paid == true,
             order_by: [desc: o.paid_at])
  end

  def membership_abbrev_for_order(nil, _memberships_by_id), do: ""
  def membership_abbrev_for_order(order_id, orders_by_id, memberships_by_id) do
    memberships_by_id[orders_by_id[order_id].membership_id].abbrev
  end

  def set_user_membership_abbrevs(stats, order_ids_by_user_id, orders_by_id, memberships_by_id) do
    for {user_id, s} <- stats, into: %{} do
      case order_ids_by_user_id[user_id] do
        nil -> {user_id, s}
        order_ids ->
          order_id = Enum.at(order_ids, 0)
          abbrev = membership_abbrev_for_order(order_id, orders_by_id, memberships_by_id)
          {user_id, put_in(s.data.mship_abbrev, abbrev)}
      end
    end
  end

  # -------------------------------------------------------------------------------------
  def link_parent(user_id, user, updated_stats) do
    cond do
      user_id == 1 -> updated_stats
      user.pside not in ["L", "R"] -> updated_stats
      true ->
        side_key = case user.pside do
          "L" -> :lid
          _   -> :rid
        end
        put_in(updated_stats, [user.pid, side_key], user_id)
    end
  end

  def set_children(stats) do
    Enum.reduce(stats, stats,
                fn {user_id, user}, updated_stats -> link_parent(user_id, user, updated_stats) end)
  end

  # -------------------------------------------------------------------------------------
  # Reminder:
  #
  # a = %{foo: %{bar: 12}}
  # %{foo: %{bar: x}} = a
  # x == 12

  # -------------------------------------------------------------------------------------
  # I could make one that did ll and rr, but for now I'll just copy...
  def srr_fn(nil, user_stats), do: user_stats

  def srr_fn(start_user_id, user_stats) do
    %{^start_user_id => %{rid: rid}} = user_stats
    srr_fn(start_user_id, rid, user_stats)
  end

  def srr_fn(_start_user_id, nil, user_stats), do: user_stats

  def srr_fn(start_user_id, right_child_id, user_stats) do
    %{^right_child_id => %{rid: rid}} = user_stats
    cond do
      is_nil(rid) -> put_in(user_stats, [start_user_id, :rrid], right_child_id)
      true -> srr_fn(start_user_id, rid, user_stats)
    end
  end

  def set_rr(stats), do: Enum.reduce(stats, stats, fn {k,_v}, acc -> srr_fn(k, acc) end)

  # -------------------------------------------------------------------------------------
  def fastll_fn(ll_id, curr_id, user_stats) do
    %{^curr_id => %{pid: parent_id, pside: side}} = user_stats
    user_stats = put_in(user_stats, [parent_id, :llid], ll_id)
    cond do
      curr_id == 1 -> user_stats
      side == "L"  -> fastll_fn(ll_id, parent_id, user_stats)
      true -> user_stats
    end
  end

  def fast_ll(stats) do
    Enum.filter(stats, fn {_k,v} -> %{lid: lid} = v; is_nil(lid) end)
    |> Enum.reduce(stats, fn {k,_v}, acc -> fastll_fn(k, k, put_in(acc, [k, :llid], k)) end)
  end

  # -------------------------------------------------------------------------------------
  def fastrr_fn(rr_id, curr_id, user_stats) do
    %{^curr_id => %{pid: parent_id, pside: side}} = user_stats
    user_stats = put_in(user_stats, [parent_id, :rrid], rr_id)
    cond do
      curr_id == 1 -> user_stats
      side == "L"  -> fastrr_fn(rr_id, parent_id, user_stats)
      true -> user_stats
    end
  end

  def fast_rr(stats) do
    Enum.filter(stats, fn {_k,v} -> %{lid: lid} = v; is_nil(lid) end)
    |> Enum.reduce(stats, fn {k,_v}, acc -> fastrr_fn(k, k, put_in(acc, [k, :rrid], k)) end)
  end

  # -------------------------------------------------------------------------------------
  def sll_fn(nil, user_stats), do: user_stats

  def sll_fn(start_user_id, user_stats) do
    %{^start_user_id => %{lid: lid}} = user_stats
    sll_fn(start_user_id, lid, user_stats)
  end

  def sll_fn(_start_user_id, nil, user_stats), do: user_stats

  def sll_fn(start_user_id, left_child_id, user_stats) do
    %{^left_child_id => %{lid: lid}} = user_stats
    cond do
      is_nil(lid) -> put_in(user_stats, [start_user_id, :llid], left_child_id)
      true -> sll_fn(start_user_id, lid, user_stats)
    end
  end

  def set_ll(stats), do: Enum.reduce(stats, stats, fn {k,_v}, acc -> sll_fn(k, acc) end)

  # -------------------------------------------------------------------------------------
  def suc_fn(1,_v,acc), do: acc
  def suc_fn(_k,v,acc) do
    %{sid: sid, sside: side} = v
    side_key = case side do
      "L" -> :uni_lcount
      "R" -> :uni_rcount
      # Since our test tree is fubared in terms of people not always being under their sponsor,
      #   impossible states like an sside being "-" are present.  We'll just fudge.
#      _ -> IO.inspect("#{k} with sponsor #{sid} has sside #{side}"); :uni_lcount
      _ -> :uni_lcount
    end

    %{^sid      => sponsor} = acc
    %{:data     => data}    = sponsor
    %{^side_key => count}   = data

    acc = put_in(acc, [sid, :data, side_key], count + 1)

    sbc_fn(sid, sponsor, acc)
  end

  def set_uni_counts(stats), do: Enum.reduce(stats, stats, fn {k,v}, acc -> suc_fn(k,v,acc) end)

  # -------------------------------------------------------------------------------------
  def sbc_fn(1,_v,acc), do: acc
  def sbc_fn(_k,v,acc) do
    %{pid: pid, pside: side} = v
    side_key = case side do
      "L" -> :bin_lcount
      "R" -> :bin_rcount
    end

    %{^pid      => parent} = acc
    %{:data     => data}   = parent
    %{^side_key => count}  = data

    acc = put_in(acc, [pid, :data, side_key], count + 1)

    sbc_fn(pid, parent, acc)
  end

  def set_bin_counts(stats), do: Enum.reduce(stats, stats, fn {k,v}, acc -> sbc_fn(k,v,acc) end)

  # -------------------------------------------------------------------------------------
  def sd_fn(id, depth, stats) do
    stats = put_in(stats, [id, :data, :depth], depth)
    %{^id => %{lid: lid, rid: rid}} = stats
    stats = if is_nil(lid) or lid == 1, do: stats, else: sd_fn(lid, depth + 1, stats)
    if is_nil(rid) or rid == 1, do: stats, else: sd_fn(rid, depth + 1, stats)
  end

  def set_depths(stats), do: sd_fn(1, 0, stats)

  # -------------------------------------------------------------------------------------
  def src_fn(1, stats, _users_by_ids), do: stats
  def src_fn(user_id, stats, users_by_id) do
    %{^user_id => %{sid: sid}} = stats
    %{^user_id => user} = users_by_id

    %{^sid => %{data: %{n_refs: n_refs,
                        n_paid_refs: n_paid_refs,
                        n_qual_refs: n_qual_refs}}} = stats

    stats = put_in(stats, [sid, :data, :n_refs], n_refs + 1)
    stats = case user.qual2 do
      nil -> stats
      _ -> put_in(stats, [sid, :data, :n_qual_refs], n_qual_refs + 1)
    end
    case user.paid_at do
      nil -> stats
      _ -> put_in(stats, [sid, :data, :n_paid_refs], n_paid_refs + 1)
    end
  end

  def set_referral_counts(stats, users_by_id) do
    Enum.reduce(stats, stats, fn {k, _v}, acc -> src_fn(k, acc, users_by_id) end)
  end

  # -------------------------------------------------------------------------------------
  def set_order_counts(stats), do: stats

  # -------------------------------------------------------------------------------------
  def initials(name) do
    # For admin, only set initials (which probably won't ever get used anyway).
    name |> String.upcase() |> String.split() |> Enum.map(&String.first/1) |> Enum.join()
  end

  def sn_fn(1,v,acc), do: put_in(acc, [1, :data, :initials], initials(v[:data][:name]))
  def sn_fn(k,v,acc) do
    %{pid: pid, sid: sid} = v
    %{data: data} = v
    %{name: name} = data

    %{^pid => parent} = acc
    %{data: pdata} = parent
    %{refcode: prefcode, name: pname, email: pemail, phone: pphone} = pdata

    %{^sid => sponsor} = acc
    %{data: sdata} = sponsor
    %{refcode: srefcode, name: sname, email: semail, phone: sphone} = sdata

    acc
    |> put_in([k, :data, :initials], initials(name))
    |> put_in([k, :data, :prefcode],  prefcode)
    |> put_in([k, :data, :pname],     pname)
    |> put_in([k, :data, :pinitials], initials(pname))
    |> put_in([k, :data, :pemail],    pemail)
    |> put_in([k, :data, :pphone],    pphone)
    |> put_in([k, :data, :srefcode],  srefcode)
    |> put_in([k, :data, :sname],     sname)
    |> put_in([k, :data, :sinitials], initials(sname))
    |> put_in([k, :data, :semail],    semail)
    |> put_in([k, :data, :sphone],    sphone)
  end

  def set_names(stats), do: Enum.reduce(stats, stats, fn {k,v}, acc -> sn_fn(k,v,acc) end)

  # -------------------------------------------------------------------------------------
  def get_side_of_sponsor(user_id, sponsor_id, stats) do
    # I would like to add loop detection, perhaps with a start_id arg, but that can wait
    #   until I figure this out generally.
    # supposedly 2x faster than stats[user_id]
    %{^user_id => %{pid: pid, pside: side}} = stats
#    %{pid: pid, pside: side} = user
    cond do
      user_id == 1      -> "-"
      pid == sponsor_id -> side
      true              -> get_side_of_sponsor(pid, sponsor_id, stats)
    end
  end

  def sos_fn(k,v,acc) do
    side = get_side_of_sponsor(k, v[:sid], acc)
    put_in(acc, [k, :sside], side)
#      {:found, side} -> put_in(acc, [k, :sside], k)
#      {:error, msg} -> Logger.error(msg) && nil
  end

  def set_side_of_sponsor(stats) do
    # Walk up the tree until we reach sponsor of a given user.
    # When we are at a node and look up to the parent, if that
    #   parent is the sponsor we are seeking, we document the
    #   current node side-of-parent.
    # That is the side of sponsor for the original node.
    Enum.reduce(stats, stats, fn {k,v}, acc -> sos_fn(k,v,acc) end)
  end

  # -------------------------------------------------------------------------------------
  def insert_stats(stats) do
    now = NaiveDateTime.utc_now()

    for row <- Map.values(stats) do
      Repo.insert(struct(UserStats, %{row | inserted_at: now}))
    end
  end

  def insert_stats_chunked(stats) do
    now = NaiveDateTime.utc_now()

    Map.values(stats)
    |> Enum.chunk_every(1000)
    |> Enum.map(fn chunk_of_rows ->
                  Repo.insert_all(UserStats,
                                  chunk_of_rows
                                  |> Enum.map(fn row -> %{row | inserted_at: now} end)) end)
  end

  # -------------------------------------------------------------------------------------
  def go() do
    Logger.configure(level: :info)

    Logger.info("gather data")
    users                 = Repo.all(User)
    users_by_id           = Map.new(users, fn u -> {u.id, u} end)
    orders                = paid_orders()
    orders_by_id          = Map.new(orders, fn o -> {o.id, o} end)
    order_ids_by_user_id  = get_order_ids_by_user_id(orders)
    memberships_by_id     = Repo.get_memberships_by_id_dict()
#    memberships_by_abbrev = get_memberships_by_abbrev(memberships_by_id)

    start_ts = :os.system_time(:millisecond)

    Logger.info("pregen stats")
    stats = pregen_stats(users)
    Logger.info("Resetting user_stats table.")
    reset_user_stats_table()
    Logger.info("membership abbrevs")
    stats = set_user_membership_abbrevs(stats, order_ids_by_user_id, orders_by_id, memberships_by_id)
    Logger.info("children")
    stats = set_children(stats)
    Logger.info("side of sponsor")
    stats = set_side_of_sponsor(stats)
    Logger.info("bin counts")
    stats = set_bin_counts(stats)
    Logger.info("uni counts")
    stats = set_uni_counts(stats)
    Logger.info("names")
    stats = set_names(stats)
    Logger.info("LL")
    stats = set_ll(stats)
    # For 5800 users, fast_ll isn't any faster than the (dumber) set_ll
#    stats = fast_ll(stats)
    Logger.info("RR")
    stats = set_rr(stats)
#    stats = fast_rr(stats)
    Logger.info("depths")
    stats = set_depths(stats)
    Logger.info("order counts (stubbed)")
    stats = set_order_counts(stats) # stubbed
    Logger.info("referral counts")
    stats = set_referral_counts(stats, users_by_id)
    Logger.info("inserting user stats into database")
    insert_stats_chunked(stats)

    end_ts = :os.system_time(:millisecond)
    Logger.info("")
    Logger.info("Runtime: #{end_ts - start_ts}ms")
    nil
  end


end