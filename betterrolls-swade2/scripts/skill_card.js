// Functions for cards representing skills

import {
    BRSW_CONST,
    BRWSRoll,
    create_common_card,
    get_action_from_click,
    get_actor_from_ids,
    get_actor_from_message,
    roll_trait,
    spend_bennie,
    trait_to_string,
    create_modifier
} from "./cards_common.js";

export const FIGHTING_SKILLS = ["fighting", "kämpfen", "pelear", "combat",
    "lutar", "combattere"];
export const SHOOTING_SKILLS = ["shooting", "schiessen", "disparar", "tir",
    "atirar", "sparare"];
export const THROWING_SKILLS = ["athletics", "athletik", "atletismo", "athletisme",
    "athlétisme", "★ athletics", "atletica"];

/**
* Creates a chat card for a skill
*
* @param {Token, SwadeActor} origin  The actor or token owning the attribute
* @param {string} skill_id The id of the skill that we want to show
* @return A promise for the ChatMessage object
*/
async function create_skill_card(origin, skill_id) {
    let actor;
    if (origin instanceof TokenDocument || origin instanceof Token) {
        actor = origin.actor;
    } else {
        actor = origin;
    }
    const skill = actor.items.find(item => {return item.id === skill_id});
    const extra_name = skill.name + ' ' + trait_to_string(skill.data.data)
    const footer = [game.i18n.localize('BRSW.Attribute') + ": " + skill.data.data.attribute]
    let trait_roll = new BRWSRoll();
    let message = await create_common_card(origin, {header:
                {type: game.i18n.localize("ITEM.TypeSkill"),
                    title: extra_name, img: skill.img},
            footer: footer, trait_roll: trait_roll, trait_id: skill.id},
        CONST.CHAT_MESSAGE_TYPES.ROLL,
        "modules/betterrolls-swade2/templates/skill_card.html")
    await message.setFlag('betterrolls-swade2', 'card_type',
        BRSW_CONST.TYPE_SKILL_CARD)
    return message;
}


/**
* Creates an skill card from a token or actor id, mainly for use in macros
*
* @param {string} token_id A token id, if it can be solved it will be used
*  before actor
* @param {string} actor_id An actor id, it could be set as fallback or
*  if you keep token empty as the only way to find the actor
* @param {string} skill_id: Id of the skill item
* @return {Promise} a promise fot the ChatMessage object
*/
function create_skill_card_from_id(token_id, actor_id, skill_id){
    const actor = get_actor_from_ids(token_id, actor_id);
    return create_skill_card(actor, skill_id);
}


/**
 * Hooks the public functions to a global object
 */
export function skill_card_hooks() {
    game.brsw.create_skill_card = create_skill_card;
    game.brsw.create_skill_card_from_id = create_skill_card_from_id;
    game.brsw.roll_skill = roll_skill;
}


/**
 * Creates a card after an event.
 * @param ev: javascript click event
 * @param {SwadeActor, Token} target: token or actor from the char sheet
 */
async function skill_click_listener(ev, target) {
    const action = get_action_from_click(ev);
    if (action === 'system') return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
    ev.stopPropagation();
    // First term for PC, second one for NPCs
    const skill_id = ev.currentTarget.parentElement.parentElement.dataset.itemId ||
        ev.currentTarget.parentElement.dataset.itemId
    // Show card
    let message = await create_skill_card(
        target, skill_id);
    if (action.includes('trait')) {
        await roll_skill(message, '', false)
    }
}


/**
 * Activates the listeners in the character sheet for skills
 * @param app: Sheet app
 * @param html: Html code
 */
export function activate_skill_listeners(app, html) {
    let target = app.token?app.token:app.object;
    const skill_labels = html.find('.skill-label a, .skill.item>a, .skill-name, .skill-die');
    skill_labels.bindFirst('click', async ev => {
        await skill_click_listener(ev, target);
    });
    // System drag listeners are on lis or spans, not as
    let skill_li = html.find('li.item.skill, span.item.skill');
    skill_li.bindFirst('dragstart',async ev => {
        // First term for PC, second one for NPCs
        const skill_id = ev.currentTarget.dataset.itemId;
        const token_id = app.token ? app.token.id : '';
        const actor_id = app.object ? app.object.id : '';
        const actor = game.actors.get(actor_id);
        const item = actor.items.get(skill_id);
        let macro_data = {name: `${actor.name}: ${item.name}`, type: "script",
            scope: "global", img: item.img};
        macro_data.command = `/*######### USAGE #########

When you click this macro or drag it on to a target, the card displayed and rolls made will be determined by whether you are holding down Ctrl, Alt, Shift, or none. Configured in Better Rolls 2 Module Settings.

#########################*/
        
if (event) {
    // If macro can detect the event (click or drag) that triggered it, get which modifier keys are held down during click or drag and apply roll behavior configured in module settings.
    let macro_behavior;
    if (event.ctrlKey===true) {
        macro_behavior=game.settings.get('betterrolls-swade2', 'ctrl_click');
    } else if (event.altKey===true) {
        macro_behavior=game.settings.get('betterrolls-swade2', 'alt_click');
    } else if (event.shiftKey===true) {
        macro_behavior=game.settings.get('betterrolls-swade2', 'shift_click');
    } else {
        macro_behavior=game.settings.get('betterrolls-swade2', 'click');
    }
    if (macro_behavior==='trait'||macro_behavior==='trait_damage') {
        // Display Better Rolls 2 card and roll trait
        game.brsw.create_skill_card_from_id('${token_id}', '${actor_id}', '${skill_id}').then(message => {
            game.brsw.roll_skill(message, "", false);
        });
    } else if (macro_behavior === 'system') {
        // Display default system card
        game.swade.rollItemMacro('${item.name}');
    } else { 
        // Display Better Rolls 2 card
        game.brsw.create_skill_card_from_id('${token_id}', '${actor_id}', '${skill_id}');
    }
} else {
    // Event not found, Display Better Rolls 2 card
    game.brsw.create_skill_card_from_id('${token_id}', '${actor_id}', '${skill_id}');
}`;
        ev.originalEvent.dataTransfer.setData(
            'text/plain', JSON.stringify({type:'Macro', data: macro_data}));
    });
}


/**
 * Activate the listeners in the skill card
 * @param message: Message date
 * @param html: Html produced
 */
export function activate_skill_card_listeners(message, html) {
    html.find('.brsw-roll-button').click(async ev =>{
        await roll_skill(message, html, ev.currentTarget.classList.contains(
            'roll-bennie-button'));
    });
    html.find('.brsw-header-img').click(_ => {
        const render_data = message.getFlag('betterrolls-swade2', 'render_data')
        const actor = get_actor_from_message(message);
        const item = actor.items.get(render_data.trait_id);
        item.sheet.render(true);
    })
}


/**
 * Roll a skill showing the roll card and the result card when enables
 *
 * @param {ChatMessage} message
 * @param {string} html Current HTML code of the message
 * @param {boolean} expend_bennie, True if we want to spend a bennie
*/
export async function roll_skill(message, html, expend_bennie){
    const render_data = message.getFlag('betterrolls-swade2', 'render_data')
    const actor = get_actor_from_message(message)
    const skill = actor.items.find((item) => item.id === render_data.trait_id);
    if (expend_bennie) await spend_bennie(actor);
    await roll_trait(message, skill.data.data , game.i18n.localize(
        "BRSW.SkillDie"), html, {});
}

/***
 * Checks if a skill is fighting, likely not the best way
 *
 * @param skill
 * @return {boolean}
 */
export function is_skill_fighting(skill) {
    let fighting_names = FIGHTING_SKILLS;
    fighting_names.push(game.settings.get('swade', 'parryBaseSkill').toLowerCase());
    return fighting_names.includes(skill.name.toLowerCase());
}

/***
 * Checks if a skill is shooting.
 * @param skill
 * @return {boolean}
 */
export function is_shooting_skill(skill) {
    let shooting_names = SHOOTING_SKILLS;
    shooting_names.push(game.i18n.localize("BRSW.ShootingSkill"));
    return shooting_names.includes(skill.name.toLowerCase());
}

/***
 * Checks if a skill is throwing
 * @param skill
 * @return {boolean}
 */
export function is_throwing_skill(skill) {
    let shooting_names = THROWING_SKILLS;
    shooting_names.push(game.i18n.localize("BRSW.ThrowingSkill"));
    return shooting_names.includes(skill.name.toLowerCase());
}

/**
 * Get a target number and modifiers from a token appropriated to a skill
 *
 * @param {Item} skill
 * @param {Token} target_token
 * @param {Token} origin_token
 * @param {SwadeItem} item
 */
export function get_tn_from_token(skill, target_token, origin_token, item) {
    let tn = {reason: game.i18n.localize("BRSW.Default"), value: 4,
        modifiers:[]};
    let use_parry_as_tn = false;
    if (is_skill_fighting(skill)) {
        use_parry_as_tn = true;
        const gangup_bonus = calculate_gangUp(origin_token, target_token)
        console.log(gangup_bonus)
        if (gangup_bonus) {
            tn.modifiers.push(create_modifier(
                game.i18n.localize("BRSW.Gangup"), gangup_bonus));
        }
    } else if (is_shooting_skill(skill) || is_throwing_skill(skill)) {
        const grid_unit = canvas.grid.grid.options.dimensions.distance
        let distance = canvas.grid.measureDistance(
            origin_token, target_token, {gridSpaces: true})
        if (distance < grid_unit * 2) {
            use_parry_as_tn = true;
        } else if (item) {
            const range = item.data.data.range.split('/')
            distance = distance / grid_unit;
            if (origin_token.data.elevation !== target_token.data.elevation) {
                let h_diff = Math.abs(
                    origin_token.data.elevation - target_token.data.elevation)
                distance = Math.sqrt(Math.pow(h_diff, 2) + Math.pow(distance, 2));
            }
            let distance_penalty = 0;
            for (let i=0; i<3 && i<range.length; i++) {
                let range_int = parseInt(range[i])
                if (range_int && range_int < distance) {
                    distance_penalty = i < 2 ? (i + 1) * 2 : 8;
                }
            }
            if (distance_penalty) {
                tn.modifiers.push(create_modifier(
                    game.i18n.localize("BRSW.Range") + " " +
                            distance.toFixed(2),
                     - distance_penalty))
            }
        }
    }
    if (use_parry_as_tn) {
        tn.reason = `${game.i18n.localize("SWADE.Parry")} - ${target_token.name}`;
        tn.value = parseInt(target_token.actor.data.data.stats.parry.value);
        const parry_mod = parseInt(target_token.actor.data.data.stats.parry.modifier);
        if (parry_mod) {
            tn.value += parry_mod;
        }
    }
    // Size modifiers
    const origin_scale_mod = sizeToScale(origin_token.actor.data.data.stats.size);
    const target_scale_mod = sizeToScale(target_token.actor.data.data.stats.size);
    if (origin_scale_mod !== target_scale_mod) {
        tn.modifiers.push(create_modifier(
            game.i18n.localize("BRSW.Scale"), target_scale_mod - origin_scale_mod))
    }
    // noinspection JSUnresolvedVariable
    if (target_token.actor.data.data.status.isVulnerable ||
            target_token.actor.data.data.status.isStunned) {
        tn.modifiers.push(create_modifier(
            `${target_token.name}: ${game.i18n.localize('SWADE.Vuln')}`,2));
    }
    return tn;
}

/**
 * Get the size modifier from size
 *
 * @param {int} size
 **/

function sizeToScale(size) { //p179 swade core
    if (size === -4) {
        return -6;
    } else if (size === -3) {
        return -4;
    } else if (size === -2) {
        return -2;
    } else if (size >= -1 && size <= 3) {
        return 0;
    } else if (size >= 4 && size <= 7) {
        return 2;
    } else if (size >= 8 && size <= 11) {
        return 4;
    } else if (size >= 12 && size <= 20) {
        return 6;
    }
}


/**
 *  Calculates gangup modifier, by Bruno Calado
 * @param {Token }attacker
 * @param {Token }target
 * @return {number} modifier
 * pg 101 swade core
 * - Each additional adjacent foe (who isn’t Stunned)
 * - adds +1 to all the attackers’ Fighting rolls, up to a maximum of +4.
 * - Each ally adjacent to the defender cancels out one point of Gang Up bonus from an attacker adjacent to both.
 */
function calculate_gangUp(attacker, target) {
  let itemRange=1; // dist 1''
  let enemies;
  let allies;
  let modifier=0;

  let withinRangeOfToken;
  let alliedWithinRangeOfToken;
  let alliedWithinRangeOfTargetAndAttacker;

  if (attacker.data.disposition === -1) { // NPC (hostile) is attacking PCs (friendly)
    withinRangeOfToken = canvas.tokens.placeables.filter(t =>
      t.id !== attacker.id
      && t.data.disposition === -1
      && t.actor.data.data.status.isStunned === false
      && t.visible
      && withinRange(target, t, itemRange)
    );
    alliedWithinRangeOfToken = canvas.tokens.placeables.filter(t =>
      t.id !== target.id
      && t.data.disposition === 1
      && t.actor.data.data.status.isStunned === false
      && withinRange(target, t, itemRange)
    );
    //alliedWithinRangeOfTargetAndAttacker intersection with attacker and target
    alliedWithinRangeOfTargetAndAttacker = alliedWithinRangeOfToken.filter(t =>
      t.data.disposition === 1
      && t.actor.data.data.status.isStunned === false
      && withinRange(attacker, t, itemRange)
    );
  } else if (attacker.data.disposition===1) { // PCs (friendly) is attacking NPC (hostile)
    withinRangeOfToken = canvas.tokens.placeables.filter(t =>
      t.id !== attacker.id
      && t.data.disposition === 1
      && t.actor.data.data.status.isStunned === false
      && t.visible
      && withinRange(target, t, itemRange)
    );
    alliedWithinRangeOfToken = canvas.tokens.placeables.filter(t =>
      t.id !== target.id
      && t.data.disposition === -1
      && t.actor.data.data.status.isStunned === false
      && withinRange(target, t, itemRange)
    );
    //alliedWithinRangeOfTargetAndAttacker intersection with attacker and target
    alliedWithinRangeOfTargetAndAttacker = alliedWithinRangeOfToken.filter(t =>
      t.data.disposition === -1
      && t.actor.data.data.status.isStunned === false
      && withinRange(attacker, t, itemRange)
    );
  }

  enemies = withinRangeOfToken.length;
  allies = alliedWithinRangeOfTargetAndAttacker.length;
  modifier = Math.max(0, (enemies-allies) );

  return Math.min( 4, modifier );
}

// function from Kekilla
function withinRange(origin, target, range) {
    const ray = new Ray(origin, target);
    const grid_unit = canvas.grid.grid.options.dimensions.distance
    let distance = canvas.grid.measureDistances([{ ray }], { gridSpaces: true })[0];
    distance = distance / grid_unit
    return range >= distance;
}