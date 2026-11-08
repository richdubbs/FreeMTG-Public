class_name PhaseBar
extends PanelContainer
## The turn and its steps (CR 500.1), with the player's stops: for each step, "stop here in my turn" and "stop here in the
## opponents' turns" toggles. A toggle sends the viewer's whole StopSettings with GameClient.stops (never
## stale) and keeps them as the default for new games (Settings). The current step is lit. Small, in the bottom right corner:
## short step names (the full name in the tooltip) and solid square toggles, bright when on.

const ROW_LABELS: Array[String] = ["", "Mine", "Theirs"]
const SHORT: Dictionary = {
	"untap": "UNT", "upkeep": "UPK", "draw": "DRW", "main1": "M1", "beginCombat": "CBT", "declareAttackers": "ATK",
	"declareBlockers": "BLK", "combatDamage": "DMG", "endCombat": "EOC", "main2": "M2", "end": "END", "cleanup": "CLN",
}
const ON: Color = Color("#3ff0ff")
const OFF: Color = Color("#0a1018")
const EDGE: Color = Color("#c8d6e5")
const TEXT: Color = Color("#ffffff")
const DIM: Color = Color("#8fa3b8")

@onready var _turn: Label = %Turn
@onready var _steps: GridContainer = %Steps

var _step_labels: Dictionary = {}
var _own: Dictionary = {}
var _opp: Dictionary = {}
var _viewer: String = ""
var _stops: Dictionary = {}
var _updating: bool = false


func _ready() -> void:
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color(0.0, 0.0, 0.0, 0.88)
	panel.border_color = EDGE
	panel.set_border_width_all(1)
	panel.set_corner_radius_all(4)
	panel.set_content_margin_all(5)
	add_theme_stylebox_override("panel", panel)
	_steps.columns = Config.STEP_ORDER.size() + 1
	for r: int in range(3):
		_steps.add_child(_label(ROW_LABELS[r], DIM))
		for step: String in Config.STEP_ORDER:
			var full := String(View.STEP_LABELS.get(step, step))
			if r == 0:
				var l := _label(String(SHORT.get(step, full.substr(0, 3).to_upper())), DIM)
				l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				l.tooltip_text = full
				l.mouse_filter = Control.MOUSE_FILTER_PASS
				_steps.add_child(l)
				_step_labels[step] = l
			else:
				var b := Button.new()
				b.toggle_mode = true
				b.focus_mode = Control.FOCUS_NONE
				b.custom_minimum_size = Vector2(22, 11)
				b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
				b.tooltip_text = "Stop in %s during %s" % [full, "my turn" if r == 1 else "the opponents' turns"]
				for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
					b.add_theme_stylebox_override(state, _box(state))
				b.toggled.connect(_on_toggled)
				_steps.add_child(b)
				if r == 1:
					_own[step] = b
				else:
					_opp[step] = b


func _label(text: String, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 9)
	l.add_theme_font_override("font", Hud.bold_font())
	l.add_theme_color_override("font_color", color)
	return l


func _box(state: String) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	var on := state.contains("pressed")
	b.bg_color = ON if on else OFF
	b.border_color = TEXT if state.begins_with("hover") else EDGE
	b.set_border_width_all(1)
	b.set_corner_radius_all(2)
	if state == "disabled":
		b.bg_color = Color(OFF, 0.6)
		b.border_color = Color(EDGE, 0.4)
	return b


func show_view(view: Dictionary) -> void:
	_viewer = View.viewer(view)
	var t := View.turn(view)
	var active := Val.text(t, "activePlayer")
	_turn.text = "Turn %d\n%s" % [Val.num(t, "number"), View.player_name(view, active)]
	var current := Val.text(t, "step")
	var colors := NeonTheme.colors()
	for step: Variant in _step_labels.keys():
		var l: Label = _step_labels[step]
		l.modulate = colors[0].lightened(0.3) if step == current else Color(1, 1, 1, 0.55)
	_stops = Val.dict(View.player(view, _viewer), "stops")
	var own := Val.texts(_stops, "ownTurn")
	var opp := Val.texts(_stops, "opponentTurn")
	_updating = true
	for step: Variant in _own.keys():
		var b: Button = _own[step]
		b.set_pressed_no_signal(own.has(String(step)))
		b.disabled = _viewer == ""
	for step: Variant in _opp.keys():
		var b: Button = _opp[step]
		b.set_pressed_no_signal(opp.has(String(step)))
		b.disabled = _viewer == ""
	_updating = false


func _on_toggled(_on: bool) -> void:
	if _updating or _viewer == "":
		return
	var own: Array[String] = []
	var opp: Array[String] = []
	for step: String in Config.STEP_ORDER:
		if (_own[step] as Button).button_pressed:
			own.append(step)
		if (_opp[step] as Button).button_pressed:
			opp.append(step)
	var settings: Dictionary = _stops.duplicate(true)
	settings["ownTurn"] = own
	settings["opponentTurn"] = opp
	if not settings.has("fullControl"):
		settings["fullControl"] = false
	GameClient.stops(_viewer, settings)
	Settings.set_stops(own, opp, Val.flag(settings, "fullControl"))
