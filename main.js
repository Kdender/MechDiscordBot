const Schedule = require('node-schedule');
const StringSimilarity = require('string-similarity');
const BetterMath = require("mathjs");
const fs = require("fs");

const {Client, MessageEmbed, DMChannel} = require('discord.js');
const client = new Client();

const tempRolesFile = './tempRoles.json';
const socialMsgIdsFile = './socialsMsgIds.txt';
const tokenFile = './token.txt';

const durationRegex = new RegExp(/\d+(min|hou|day|mon)/);

//mech Test server: 700082109511106571
//mechanists: 647255354693910549
let mechanists = '647255354693910549';

const cmdPrefix = '!';
const topicPrefixLength = 15;

let logChannel = 'mod-log';
let cmdChannel = 'bot-spam';
let boardChannel = '🛹board';
let infoChannel = '📋server-info';
let streamChannel = 'stream-announcements';
let memesChannel = '🥫memes';

//:do_not_litter: 🚯
const reactDelete = {emoji: '🚯', reqRole: 'Member'};
const reactMute = {emoji: '🔇', reqRole: 'Member'};

let pendingReactMutes = [];
let streaming = [];
let stpdStreaming = {};

const ROLE_STREAMING = 'Streaming!';
const ROLE_SUPPORTER = 'Supporter';
const ROLE_SUPPORTER_LVL_2 = 'Supporter LvL 2';
//mod roles
const ROLE_MEMBER = 'Member';
const ROLE_ADMIN = 'Admin';
const ROLE_STAFF = 'Staff';
const ROLE_BOARD = 'Board';
const ROLE_TOOM = 'Temporarily Out Of Order Member';
const ROLE_PONG = 'Pong';
//giveable roles
const ROLE_BIG_BRAIN = 'Big Brain';
const ROLE_CMP_ACCESS = 'CMP Access';
const ROLE_MUTED = 'Muted';
const ROLE_MEME_PRISONER = 'Meme Prisoner';

const supporterRoles = ['Nitro Booster', 'Cuber Sub', 'Ajvejs Sub', 'Kdender Sub', 'Kdender Patreon'];
const supporterLvl2Roles = ['Kdender Patreon LvL 2', 'Tier 2 Cuber Sub', 'Tier 2 Ajvej Sub', 'Tier 2 Kdender Sub', 'Tier 2 Desktop Sub', 'Tier 3 Cuber Sub', 'Tier 3 Ajvej Sub', 'Tier 3 Kdender Sub', 'Tier 3 Desktop Sub'];

const giveableRoles = {
    [ROLE_BIG_BRAIN]: {reqRoles: ['Member']},
    [ROLE_CMP_ACCESS]: {reqRoles: ['Member']},
    [ROLE_MUTED]: {reqRoles: ['Member']},
    [ROLE_MEME_PRISONER]: {reqRoles: ['Member']},
};

const botPresences = [
    {activity: {type: 'PLAYING', name: '""vanilla""'}},
    {activity: {type: 'PLAYING', name: 'vanilla++'}},
    {activity: {type: 'PLAYING', name: 'on Mechanists'}},
    {activity: {type: 'WATCHING', name: 'Slippzy dig'}},
    {activity: {type: 'WATCHING', name: "Kdender's YouTube Videos"}},
    {activity: {type: 'WATCHING', name: "SpeedCuber's Stream"}},
    {activity: {type: 'COMPETING', name: 'Epic Bot Battles'}},
    {activity: {type: 'COMPETING', name: 'Perimeter Speedruns'}},
    {activity: {type: 'LISTENING', name: "Ragou42's puns"}},
    {activity: {type: 'LISTENING', name: "THE SOUND 🐢"}},
];


client.once('ready', () => {

    setup();
    setPresence();

    logInfo('boot', 'Mech booted up!');
});


client.on('message', message => {
    if (message.channel instanceof DMChannel && !message.author.bot) logDM(message);

    if (!message.content.startsWith(cmdPrefix) || message.author.bot) return;

    command(message);
});

client.on('messageReactionAdd', (reaction, user) => {
    reactionAdd(reaction, user);
});

client.on('guildMemberRemove', member => {
    const roles = member.roles.cache;
    memberLeaveGuild(member, roles);
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
    //if (oldMember.pending && !newMember.pending)
    //    mechanists.systemChannel.send(
    //        'Welcome ' + member.displayName + '! o/' +
    //        '\nCheck out ' + infoChannel.toString() + ' for more information :)');

    if (hasARole(newMember, supporterRoles)) {
        if (!hasARole(oldMember, supporterRoles))
            newMember.roles.add(getRole(ROLE_SUPPORTER))

    } else if (hasARole(oldMember, supporterRoles)) {
        newMember.roles.remove(getRole(ROLE_SUPPORTER));

        if (newMember.roles.cache.find(r => r.name.includes('whitelist'))) {
            channelLogInfo(newMember.toString() + ' lost their supporter role. Whitelists needs to be removed. id: ' + newMember.id + ' tag: ' + newMember.user.tag);
        }
    }

    if (hasARole(newMember, supporterLvl2Roles)) {
        if (!hasARole(oldMember, supporterLvl2Roles))
            newMember.roles.add(getRole(ROLE_SUPPORTER_LVL_2))

    } else if (hasARole(oldMember, supporterLvl2Roles)) {
        newMember.roles.remove(getRole(ROLE_SUPPORTER_LVL_2));

        if (newMember.roles.cache.find(r => r.name.includes('whitelist') && r.name.includes('2'))) {
            channelLogInfo(newMember.toString() + ' lost their supporter lvl 2 role. LvL 2 whitelists need to be removed. id: ' + newMember.id + ' tag: ' + newMember.user.tag);
        }
    }
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (newPresence.activities) {
        newPresence.activities.forEach(activity => {

            if (activity.type !== "STREAMING") return;
            if (oldPresence && oldPresence.activities && oldPresence.activities.find(a => a.type === 'STREAMING')) return;

            startedStreaming(activity, newPresence.user);
        });
    }

    if (oldPresence && oldPresence.activities) {
        oldPresence.activities.forEach(activity => {

            if (activity.type !== "STREAMING") return;
            if (newPresence.activities && newPresence.activities.find(a => a.type === 'STREAMING')) return;

            stoppedStreaming(newPresence.user);
        });
    }
});

/*
*    *    *    *    *    *
 ┬    ┬    ┬    ┬    ┬    ┬
 │    │    │    │    │    │
 │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
 │    │    │    │    └───── month (1 - 12)
 │    │    │    └────────── day of month (1 - 31)
 │    │    └─────────────── hour (0 - 23)
 │    └──────────────────── minute (0 - 59)
 └───────────────────────── second (0 - 59, OPTIONAL)
 */
Schedule.scheduleJob('0 16 * * 6', () => {
    boardChannel.send(getRole(ROLE_BOARD).toString() + ' Meeting in 1 hour lazy asses')
});
Schedule.scheduleJob('0 17 * * 6', () => {
    boardChannel.send(getRole(ROLE_BOARD).toString() + ' MEETING!')
});

Schedule.scheduleJob('0 0 * * *', () => {
    setPresence();
});

Schedule.scheduleJob('0 * * * * *', () => {
    checkTempRoles();
    checkSupporterRoles();
    checkStpdStreaming();
});

client.login(fs.readFileSync(tokenFile, {encoding: 'utf-8'}));


function setup() {
    mechanists = client.guilds.cache.get(mechanists);

    logChannel = mechanists.channels.cache.find(c => c.name === logChannel);
    cmdChannel = mechanists.channels.cache.find(c => c.name === cmdChannel);
    boardChannel = mechanists.channels.cache.find(c => c.name === boardChannel);
    infoChannel = mechanists.channels.cache.find(c => c.name === infoChannel);
    streamChannel = mechanists.channels.cache.find(c => c.name === streamChannel);
    memesChannel = mechanists.channels.cache.find(c => c.name === memesChannel);
}

function command(message) {
    let delMsg = true;
    let args = [];
    let i = 0;

    let argsSplit1 = message.content.slice(cmdPrefix.length).split(/"/);

    argsSplit1.forEach(arg => {

        if (i % 2 !== 0) {
            args.push(arg.trim());
        } else {
            arg.trim().split(/ /).forEach(arg1 => {
                args.push(arg1);
            })
        }

        i++
    });
    args = args.filter((arg => {
        return arg !== '';
    }));

    if (args.length < 1) return;

    switch (args[0].toLowerCase()) {
        case 'debug':
            client.user.setAvatar('https://media.discordapp.net/attachments/784544422070452294/818826485896839178/mechGear_render_1k.png');
            break;

        case 'ping':
            message.channel.send('pong!');
            delMsg = false;
            break;

        case 'emoji':
            if (args.length < 2 || isBadString(args[1])) break;
            message.channel.send('\\' + args[1]);
            delMsg = false;
            break;

        case 'giverole':
            commandGiveRole(message, args);
            break;

        case 'removerole':
            commandRemoveRole(message, args);
            break;

        case 'givetemprole':
            commandGiveTempRole(message, args);
            break;

        case 'listrole':
            commandListRole(message, args);
            break;

        case 'presence':
            setPresence(true, (args.length > 1) ? parseInt(args[1]) : undefined);
            break;

        case 'deny':
            commandDeny(message, args);
            delMsg = false;
            break;

        case 'sendmsg':
            commandSendMsg(message, args);
            delMsg = false;
            break;

        case '=':
            if (!hasRole(message.member, ROLE_MEMBER)) break;
            try {
                if (args.length > 1 && !isBadString(args[1])) message.channel.send(BetterMath.evaluate(args[1]));
                delMsg = false;
            } catch (e) {
            }
            break;

        case 'sendsocials':
            commandSendSocials(message);
            break;

        case 'updatesocials':
            commandUpdateSocials(message);
            break;

        case 'updateskins':
            commandUpdateSkins(message);
            break;

        case 'updateskin':
            if (args.length < 2)
                break;
            commandUpdateSkin(message, args[1]);
            break;

        case "inactive":
        case "lazysmh":
            commandInactive(message);
            break;

        case "activeagain":
        case "active":
            commandActive(message);
            break;

        default:
            if (StringSimilarity.compareTwoStrings('members', args[0].toLowerCase()) > 0.4) {
                const emojis = {
                    'members': '',
                    'memebers': ':turtle: ',
                    'membras': ':musical_note: ',
                    'meme': '<:hehe:710897044084097064> '
                };
                message.channel.send(((emojis[args[0]] != null) ? emojis[args[0]] : '<:wow:750843523594715157> ') + mechanists.memberCount);
                delMsg = false;
            }
    }

    if (message.channel !== cmdChannel && message.channel !== boardChannel && delMsg) message.delete();
}

function reactionAdd(reaction, user) {
    const message = reaction.message;
    const messageAuthor = message.member;
    const reactor = message.guild.member(user);
    const reactionEmoji = reaction.emoji.name;

    if (!messageAuthor)
        return;

    if (pendingReactMutes[message]) {
        if (reactor.user.bot)
            return;

        let duration;
        let durationString;
        const targetMember = pendingReactMutes[message].target;
        const url = pendingReactMutes[message].url;

        switch (reactionEmoji) {
            case "🇦":
                duration = 60 * 60 * 1000;
                durationString = '1 hour';
                break;
            case "🇧":
                duration = 24 * 60 * 60 * 1000;
                durationString = '1 day';
                break;
            case "🇨":
                duration = 7 * 24 * 60 * 60 * 1000;
                durationString = '1 week';
                break;
            case "🇩":
                duration = 28 * 24 * 60 * 60 * 1000;
                durationString = '1 month';
                break;
            case "🇪":
                giveRole(targetMember, ROLE_MUTED, url, reactor);
                break;
            case "❌":
                message.delete();
                break;
            default:
                return;
        }

        if (duration) {
            giveTempRole(ROLE_MUTED, targetMember, duration)
                .then(() => {
                    const embed = new MessageEmbed()
                        .setTitle('temporary mute')
                        .setColor(0xee3333)
                        .setDescription(
                            targetMember.toString() + ' has been temporarily muted for ' + durationString +
                            ' by ' + reactor.toString() +
                            '\n**reason:** ' + url);

                    logChannel.send(embed);
                    logChannel.send(targetMember.toString());
                    logInfo('tempRoles', targetMember.user.tag + ' has been temporarily muted for ' + durationString + ' by ' + reactor.user.tag);

                    targetMember.send('You have been muted for ' + durationString).catch();
                });
        }
        pendingReactMutes[message] = undefined;
        return;
    }

    switch (reactionEmoji) {
        case reactDelete.emoji:
            if (!hasRole(reactor, reactDelete.reqRole)) return;

            deleteMessage(message, user);

            if (message.channel === memesChannel) {
                const role = getRole(ROLE_MEME_PRISONER);

                giveTempRole(ROLE_MEME_PRISONER, messageAuthor, 24 * 60 * 60 * 1000)
                    .then(() => {
                        const embed = new MessageEmbed()
                            .setTitle('temporary role ' + ROLE_MEME_PRISONER)
                            .setColor(0xee3333)
                            .setDescription(
                                messageAuthor.toString() + ' has been temporarily given the ' + role.toString() + ' role for 1 day by ' + reactor.toString() +
                                '\n**reason:** ' + 'inappropriate behaviour in #memes');

                        logChannel.send(embed);
                        logChannel.send(messageAuthor.toString());
                        logInfo('tempRoles', messageAuthor.user.tag + ' has been temporarily given the "' + ROLE_MEME_PRISONER + '" role for 1 day by ' + reactor.user.tag);
                    });
            }
            break;
        case reactMute.emoji:
            if (!hasRole(reactor, reactMute.reqRole)) return;

            cmdChannel.send(reactor.toString() +
                "\nmute user " + messageAuthor.toString() + " for" +
                "\n🇦 1 hour" +
                "\n🇧 1 day" +
                "\n🇨 1 week" +
                "\n🇩 1 month" +
                "\n🇪 forever" +
                "\n❌ cancel")
                .then(msg => {
                    msg.react("🇦");
                    msg.react("🇧");
                    msg.react("🇨");
                    msg.react("🇩");
                    msg.react("🇪");
                    msg.react("❌");
                    pendingReactMutes[msg] = {target: messageAuthor, url: message.url};
                });
            break;
    }


}

async function memberLeaveGuild(member, roles) {

    const fetchedLog = await member.guild.fetchAuditLogs({
        limit: 1,
        type: 'MEMBER_KICK',
    });

    const kickLog = fetchedLog.entries.first();

    if (roles.find(r => r.name === ROLE_MUTED)) {
        banMember(member, client, 'left the server while being muted');
    }
    if (roles.find(r => r.name.includes('whitelist'))) {
        channelLogInfo(member.user.tag + ' left the server with a whitelist role. id: ' + member.id);
    }

    if (!kickLog) {
        logInfo('leave', member.user.tag + ' left the server');

        return;
    }

    const {executor, target} = kickLog;

    if (kickLog.createdAt < member.joinedAt) {
        logInfo('leave', member.user.tag + ' left the server');
        return;
    }

    if (target.id === member.id) {
        logInfo('leave', `${member.user.tag} left the guild; kicked by ${executor.tag}?`);
    } else {
        logInfo('leave', `${member.user.tag} left the guild, audit log fetch was inconclusive.`);
    }
}

async function checkTempRoles() {
    let line;
    let targetMember;
    let tempRoleSplit;
    const now = Date.now();
    let data = fs.readFileSync(tempRolesFile, {encoding: 'utf-8'});

    data.split('\n').forEach(string => {
        if (string.startsWith('#')) return;
        line = string.split(': ');

        if (!line[1] || line[1].length < 1) {
            data = data.replace("\n" + string, "");
            return;
        }

        targetMember = mechanists.member(line[0]);
        targetMember = mechanists.member(line[0]);

        line[1].split('; ').forEach(tempRoleString => {
            if (tempRoleString.length < 1)
                return;

            if (!targetMember) {
                data = data.replace(tempRoleString + "; ", "");
                logInfo('tempRoles', 'removed id ' + line[0] + " from temporary roles as the owner seems to have left the server (" + tempRoleString + ')');
                return;
            }

            if (parseInt((tempRoleSplit = tempRoleString.split(', '))[1]) > now)
                return;

            targetMember.roles.remove(getRole(tempRoleSplit[0]));
            data = data.replace(tempRoleString + "; ", "");
            logInfo('tempRoles', 'removed ' + targetMember.user.tag + "'s " + tempRoleSplit[0] + ' role as it expired');
        })
    });

    fs.writeFileSync(tempRolesFile, data);
}

async function checkSupporterRoles() {

    let role = getRole(ROLE_SUPPORTER);

    role.members.forEach(member => {
        if (!hasARole(member, supporterRoles)) {
            member.roles.remove(getRole(ROLE_SUPPORTER));

            if (member.roles.find(r => r.name.includes('whitelist'))) {
                channelLogInfo(member.toString() + ' lost their supporter role. Whitelists needs to be removed. id: ' + member.id + ' tag: ' + member.user.tag);
            }
        }
    });

    supporterRoles.forEach(roleString => {
        role = getRole(roleString);
        if (!role)
            return;

        role.members.forEach(member => {
            if (!hasRole(member, ROLE_SUPPORTER))
                member.roles.add(getRole(ROLE_SUPPORTER));
        });
    });

    // LVL 2
    role = getRole(ROLE_SUPPORTER_LVL_2);

    role.members.forEach(member => {
        if (!hasARole(member, supporterLvl2Roles)) {
            member.roles.remove(getRole(ROLE_SUPPORTER_LVL_2));

            if (member.roles.find(r => r.name.includes('whitelist') && r.name.includes('2'))) {
                channelLogInfo(member.toString() + ' lost their supporter lvl 2 role. LvL 2 whitelists need to be removed. id: ' + member.id + ' tag: ' + member.user.tag);
            }
        }
    });

    supporterLvl2Roles.forEach(roleString => {
        role = getRole(roleString);
        if (!role)
            return;

        role.members.forEach(member => {
            if (!hasRole(member, ROLE_SUPPORTER_LVL_2))
                member.roles.add(getRole(ROLE_SUPPORTER_LVL_2));
        });
    });
}

async function checkStpdStreaming() {
    for (const [key, value] of Object.entries(stpdStreaming)) {
        stpdStreaming[key]--;

        if (stpdStreaming[key] < 0) {
            const member = mechanists.member(key);

            logInfo('streaming', member.user.tag + ' stopped streaming');

            member.roles.remove(getRole(ROLE_STREAMING))
                .catch(() => logWarn('could not remove the streaming role of ' + member.user.tag));

            delete stpdStreaming[key];
        }
    }
}


//-----------COMMANDS

function commandGiveRole(message, args) {
    const author = message.member;

    if (args.length < 4) return channelLogInfo('usage: ' + cmdPrefix + 'giveRole "[role]" [user] "[reason]"', author);

    const giveableRole = giveableRoles[args[1]];
    if (!giveableRole) return channelLogInfo('This is not a giveable role', author);

    if (!hasARole(author, giveableRole.reqRoles)) return channelLogInfo("you aren't powerful enough!", author);

    const targetMember = message.guild.member(getUserFromMention(args[2]));
    if (!targetMember) return channelLogInfo("This user doesn't exist", author);

    giveRole(targetMember, args[1], args[3], author)
        .then(() => {
            message.react('✅');
        })
        .catch(() => {
            logChannel("Couldn't give role.");
        });
}

function commandRemoveRole(message, args) {
    const author = message.member;

    if (args.length < 4) return channelLogInfo('usage: ' + cmdPrefix + 'removerole "[role]" [user] "[reason]"', author);

    const giveableRole = giveableRoles[args[1]];
    if (!giveableRole) return channelLogInfo('This is not a giveable role', author);

    if (!hasARole(author, giveableRole.reqRoles)) return channelLogInfo("you aren't powerful enough!", author);

    const targetMember = message.guild.member(getUserFromMention(args[2]));
    if (!targetMember) return channelLogInfo("This user doesn't exist", author);


    const role = getRole(args[1]);
    targetMember.roles.remove(role)
        .then(() => {

            const embed = new MessageEmbed()
                .setTitle('removed role ' + role.name)
                .setColor(0x444444)
                .setDescription(
                    message.member.toString() + ' removed ' + targetMember.toString() + "'s " + role.toString() + ' role' +
                    '\n**reason:** ' + args[3]);

            logChannel.send(embed);
            logChannel.send(targetMember.toString());
            logInfo('roles', message.member.user.tag + ' removed ' + targetMember.user.tag + "'s " + role.name + ' role');
            message.react('✅');
        })
        .catch((error) => channelLogInfo('error: ' + error, author));
}

function commandDeny(message, args) {
    const channel = message.channel;

    if (channel !== boardChannel) return;
    if (args.length < 2) return channel.send('usage: ' + cmdPrefix + 'deny [user] "[opt. reason]"');

    const targetMember = message.guild.member(getUserFromMention(args[1]));
    if (!targetMember) return boardChannel.send("This user doesn't exist");

    targetMember.send("Unfortunately your application for the Mechanists server hasn't been accepted" +
        ((args.length > 2) ? ':\n' + args[2] : ''))
        .then(() => {
            message.react('✅');
        })
        .catch(() => {
            channel.send("Couldn't send message.");
        });
}

function commandSendMsg(message, args) {
    const author = message.member;

    if (!hasRole(author, ROLE_BOARD)) return channelLogInfo("You aren't powerful enough!", author, (message.channel === boardChannel) ? boardChannel : cmdChannel);
    if (args.length < 3) return channelLogInfo('usage: ' + cmdPrefix + 'deny [user] "[reason]"', author, (message.channel === boardChannel) ? boardChannel : cmdChannel);

    const targetMember = message.guild.member(getUserFromMention(args[1]));
    if (!targetMember) return channelLogInfo("This user doesn't exist", author, (message.channel === boardChannel) ? boardChannel : cmdChannel);

    targetMember.send(args[2])
        .then(() => {
            message.react('✅');
        })
        .catch(() => {
            logChannel("Couldn't send message.");
        });
}

function commandGiveTempRole(message, args) {
    const author = message.member;

    if (args.length < 5) return channelLogInfo('usage: ' + cmdPrefix + 'givetemprole "[role]" [user] "[reason]" [duration]', author);

    const giveableRole = giveableRoles[args[1]];
    if (!giveableRole) return channelLogInfo('This is not a giveable role', author);

    if (!hasARole(author, giveableRole.reqRoles)) return channelLogInfo("you aren't powerful enough!", author);

    const targetMember = message.guild.member(getUserFromMention(args[2]));
    if (!targetMember) return channelLogInfo("This user doesn't exist", author);

    if (!durationRegex.test(args[4])) return channelLogInfo('the duration must consist of a number and ' +
        '\nmin (= minutes),' +
        '\nhou (= hours),' +
        '\nmon (= months) or' +
        '\nday (= days) as the unit (e.g. 10min => 10 minutes) ', author);

    let duration = parseInt(args[4].substring(0, args[4].length - 3));
    switch (args[4].substring(args[4].length - 3, args[4].length)) {
        case "min":
            duration *= 60 * 1000;
            break;
        case "hou":
        case "h":
            duration *= 60 * 60 * 1000;
            break;
        case "day":
        case "d":
            duration *= 24 * 60 * 60 * 1000;
            break;
        case "mon":
            duration *= 28 * 24 * 60 * 60 * 1000;
            break;
    }

    giveTempRole(args[1], targetMember, duration);

    const role = getRole(args[1]);
    targetMember.roles.add(role)
        .then(() => {

            const embed = new MessageEmbed()
                .setTitle('temporary role ' + role.name)
                .setColor(0x009900)
                .setDescription(
                    targetMember.toString() + ' has been temporarily given the ' + role.toString() + ' role for ' + args[4] + ' by ' + author.toString() +
                    '\n**reason:** ' + args[3]);

            logChannel.send(embed);
            logChannel.send(targetMember.toString());
            logInfo('tempRoles', targetMember.user.tag + ' has been temporarily given the "' + role.name + '" role for ' + args[4] + ' by ' + author.user.tag);

            if (args[1] === 'Muted')
                targetMember.send('You have been muted for ' + args[4]).catch();

                message.react('✅');
        })
        .catch((error) => channelLogInfo('error: ' + error, author));
}

async function commandSendSocials(message) {
    if (!hasRole(message.member, ROLE_ADMIN))
        return;

    const members = require('./members.json');

    const emojiGuild = message.client.guilds.cache.find(({name}) => name === 'Mech Bot Emojis');
    const emojiManager = emojiGuild.emojis;
    const length = Object.keys(members).length;

    const embed1 = new MessageEmbed({
        title: `<a:mechanistsSpin:819631661938770030>  Mechanists Members`,
        color: '#3498db'
    });
    const embed2 = new MessageEmbed({color: '#3498db'});

    const data = Object.entries(members).map(([member, {ign, youtube, twitch, twitter}]) => {
        const escapedName = member.replace(/\s+/gi, '');
        const name = `${emojiManager.cache.find(({name}) => name === escapedName)} ${member}`;
        const socials = [
            youtube && `[Youtube](https://www.youtube.com/${youtube})`,
            twitch && `[Twitch](https://www.twitch.tv/${twitch})`,
            twitter && `[Twitter](https://twitter.com/${twitter})`
        ];
        const value = socials.filter(Boolean).join(' | ') || 'None';
        return {name, value, inline: true};
    });
    embed1.addFields(data.slice(0, Math.ceil(length / 2)));
    embed2.addFields(data.slice(Math.ceil(length / 2)));

    const msg1 = await infoChannel.send(embed1);
    const msg2 = await infoChannel.send(embed2);

    fs.writeFileSync(socialMsgIdsFile, msg1.id + '-' + msg2.id);

    message.react('✅');
}

async function commandUpdateSocials(message) {
    if (!hasRole(message.member, ROLE_ADMIN))
        return;

    const members = require('./members.json');

    const emojiGuild = message.client.guilds.cache.find(({name}) => name === 'Mech Bot Emojis');
    const emojiManager = emojiGuild.emojis;
    const length = Object.keys(members).length;

    const embed1 = new MessageEmbed({
        title: `<a:mechanistsSpin:819631661938770030>  Mechanists Members`,
        color: '#3498db'
    });
    const embed2 = new MessageEmbed({color: '#3498db'});

    const data = Object.entries(members).map(([member, {ign, youtube, twitch, twitter}]) => {
        const escapedName = member.replace(/\s+/gi, '');
        const name = `${emojiManager.cache.find(({name}) => name === escapedName)} ${member}`;
        const socials = [
            youtube && `[Youtube](https://www.youtube.com/${youtube})`,
            twitch && `[Twitch](https://www.twitch.tv/${twitch})`,
            twitter && `[Twitter](https://twitter.com/${twitter})`
        ];
        const value = socials.filter(Boolean).join(' | ') || 'None';
        return {name, value, inline: true};
    });
    embed1.addFields(data.slice(0, Math.ceil(length / 2)));
    embed2.addFields(data.slice(Math.ceil(length / 2)));

    const msgIds = fs.readFileSync(socialMsgIdsFile, {encoding: 'utf-8'});

    infoChannel.messages.fetch(msgIds.split('-')[0]).then(msg => msg.edit(embed1));
    infoChannel.messages.fetch(msgIds.split('-')[1]).then(msg => msg.edit(embed2));

    message.react('✅');
}

async function commandUpdateSkins(message) {
    const members = require('./members.json');

    const emojiGuild = message.client.guilds.cache.find(({name}) => name === 'Mech Bot Emojis');
    const emojiManager = emojiGuild.emojis;

    Object.entries(members).forEach(async ([member, {ign}]) => {
        const escapedName = member.replace(/\s+/gi, '');
        await emojiManager.cache.find(({name}) => name === escapedName)?.delete();
        await emojiManager.create(`https://minepic.org/avatar/${ign}`, escapedName);
        console.log(`Updated skin for ${member}`);
    });

    message.react('✅');
}

async function commandUpdateSkin(message, name) {
    const members = require('./members.json');

    const emojiGuild = message.client.guilds.cache.find(({name}) => name === 'Mech Bot Emojis');
    const emojiManager = emojiGuild.emojis;

    Object.entries(members).forEach(async ([member, {ign}]) => {
        if (member !== name)
            return;

        const escapedName = member.replace(/\s+/gi, '');
        await emojiManager.cache.find(({name}) => name === escapedName)?.delete();
        await emojiManager.create(`https://minepic.org/avatar/${ign}`, escapedName);
        console.log(`Updated skin for ${member}`);
    });

    message.react('✅');
}

function commandListRole(message, args) {
    const author = message.member;

    if (args.length < 2)
        return channelLogInfo('usage: ' + cmdPrefix + 'listRole "[role]"', author);

    if (message.channel !== cmdChannel && message.channel !== boardChannel)
        return channelLogInfo("You can't use this command in that channel", author);

    const role = getRole(args[1]);
    if (!role)
        return channelLogInfo("This role doesn't exist", undefined, message.channel);

    if (role.members.size > 100)
        return channelLogInfo("Too many people have this role", undefined, message.channel);

    if (role.members.size < 1)
        return channelLogInfo("Nobody has this role", undefined, message.channel);

    const pingsString = role.members.map(m => m.toString()).join(' \n');
    const tagsString = role.members.map(m => m.user.tag).join(' \n');

    if (pingsString.length < 1024 && tagsString.length < 1024) {
        const embed = new MessageEmbed()
            .setTitle(role.members.size + ' users with role ' + role.name)
            .setColor(0x3498db)
            .addField("Ping", pingsString, true)
            .addField("Tag", tagsString, true);

        message.channel.send(embed);
    } else {

        const fstSplitPings = pingsString.indexOf(' \n', pingsString.length / 3 + 1);
        const sndSplitPings = pingsString.indexOf(' \n', pingsString.length / 3 * 2 + 1);
        const fstSplitTags = nthIndex(tagsString, ' \n', pingsString.substring(0, fstSplitPings).split(' \n').length);
        const sndSplitTags = nthIndex(tagsString, ' \n', pingsString.substring(0, sndSplitPings).split(' \n').length);

        const embed0 = new MessageEmbed()
            .setTitle(role.members.size + ' users with role ' + role.name)
            .setColor(0x3498db)
            .addField("Ping", pingsString.substring(0, fstSplitPings), true)
            .addField("Tag", tagsString.substring(0, fstSplitTags), true);

        message.channel.send(embed0);

        const embed1 = new MessageEmbed()
            .setColor(0x3498db)
            .addField("\u200B", pingsString.substring(fstSplitPings, sndSplitPings), true)
            .addField("\u200B", tagsString.substring(fstSplitTags, sndSplitTags), true);

        message.channel.send(embed1);

        const embed2 = new MessageEmbed()
            .setColor(0x3498db)
            .addField("\u200B", pingsString.substring(sndSplitPings), true)
            .addField("\u200B", tagsString.substring(sndSplitTags), true);

        message.channel.send(embed2);
    }
}

function commandInactive(message) {
    const author = message.member;

    if (!hasRole(author, ROLE_MEMBER)) return channelLogInfo("you aren't powerful enough!", author);

    giveRole(author, ROLE_TOOM, "lazy smh", author)
        .then(() => {
            author.roles.remove(getRole(ROLE_PONG))
        })
        .then(() => {
            message.react('✅');
        })
        .catch(() => {
            logChannel("Couldn't give role.");
        });
}

function commandActive(message) {
    const author = message.member;

    if (!hasRole(author, ROLE_MEMBER)) return channelLogInfo("you aren't powerful enough!", author);

    giveRole(author, ROLE_PONG, "better actually be active :sus:", author)
        .then(() => {
            author.roles.remove(getRole(ROLE_TOOM))
        })
        .then(() => {
            message.react('✅');
        })
        .catch(() => {
            logChannel("Couldn't give role.");
        });
}


//-----------DISCORD RELATED

function deleteMessage(message, deleter, reason = 'none') {
    if (message.channel === logChannel) return;

    const embed = new MessageEmbed()
        .setTitle('message deleted')
        .setColor(0x880000)
        .setDescription(
            deleter.toString() + ' deleted the message of ' + message.author.toString() + ' in <#' + message.channel.id + '>:' +
            '\n"' + message.content + '"' +
            '\n**reason:** ' + reason);

    const attachment = message.attachments.first();
    if (attachment) embed.setImage(attachment.proxyURL);

    logChannel.send(embed);
    logChannel.send(message.author.toString());
    logInfo('msgDeletion', deleter.tag + ' deleted the message of ' + message.author.tag + ' in #' + message.channel.name);
    message.delete();
}

function getUserFromMention(mention) {
    if (!mention) return;
    return client.users.cache.get(mention.replace(/[<@!>]/g, ''));
}

function banMember(targetMember, banner = client, reason = 'none') {
    targetMember.ban({reason: reason})
        .then(() => {
            logInfo('ban', 'banned ' + targetMember.user.tag);

            targetMember.send('You have been banned due to leaving while you were muted.')
                .catch(() => logWarn('could not inform ' + targetMember.user.tag + ' about their ban'));

            const embed = new MessageEmbed()
                .setTitle('member banned')
                .setColor(0xee0000)
                .setDescription(
                    mechanists.member(banner.user).toString() + ' banned ' + targetMember.toString() +
                    '\n**reason:** ' + reason);

            logChannel.send(embed);
            logChannel.send(targetMember.toString());
        })
        .catch(() => logWarn('could not ban ' + targetMember.user.tag));
}

function logDM(message) {
    const embed = new MessageEmbed()
        .setTitle('received private message')
        .setColor(0x009999)
        .setDescription(
            message.author.toString() + ' sent a private message:' +
            '\n"' + message.content + '"' +
            '\n**attachments:** ' + getURLs(message.attachments));

    cmdChannel.send(embed);
    cmdChannel.send(message.author.toString());
}

function startedStreaming(activity, user) {
    const member = mechanists.member(user);

    if (streaming.includes(member.id)) return;
    if (!hasRole(member, ROLE_MEMBER)) return;

    streaming.push(member.id);

    if (stpdStreaming[member.id]){
        delete stpdStreaming[member.id];
        return;
    }

    logInfo('streaming', user.tag + ' just started streaming');
    streamChannel.send('OH WOWIE! \n' +
        '**' + user.username + '** just started streaming ' + activity.state + ':\n' +
        activity.details + '\n' +
        activity.url);

    member.roles.add(getRole(ROLE_STREAMING))
        .catch(() => logWarn('could not give ' + user.tag + ' the streaming role'));
}

function stoppedStreaming(user) {
    const member = mechanists.member(user);

    if (!streaming.includes(member.id)) return;
    if (!hasRole(member, ROLE_MEMBER)) return;

    streaming.splice(streaming.indexOf(member.id), 1);
    stpdStreaming[member.id] = 3;
}

function setPresence(command, i) {
    if (botPresences.length < 1) {
        logWarn('no bot presences available');
        if (command) channelLogInfo('no presences available');
        return;
    }
    if (!client.user) return logWarn('[Presence] client.user is undefined');

    if (i && botPresences.length >= i && i >= 0) {
        client.user.setPresence(botPresences[i]);
        logInfo('presence', 'presence ' + i + ' set');
        if (command) channelLogInfo('presence ' + i + ' set');
        return;
    }
    client.user.setPresence(botPresences[Math.floor(Math.random() * botPresences.length)]);
    logInfo('presence', 'random presence set');
    if (command) channelLogInfo('random presence set');
}

function channelLogInfo(info, member, channel = cmdChannel) {
    channel.send(((member) ? member.toString() + ' ' : '') + info);
}

function hasRole(member, role) {
    return member.roles.cache.find(r => r.name === role);
}

function hasARole(member, roles) {
    return member.roles.cache.find(r => roles.find(r2 => r2 === r.name));
}

function getRole(roleString) {
    return mechanists.roles.cache.find(r => r.name === roleString)
}

function giveRole(targetMember, roleString, reason, author) {
    const role = getRole(roleString);
    return targetMember.roles.add(role)
        .then(() => {

            const embed = new MessageEmbed()
                .setTitle('gave role ' + role.name)
                .setColor(0x00bb00)
                .setDescription(
                    targetMember.toString() + ' has been given the ' + role.toString() + ' role by ' + author.toString() +
                    '\n**reason:** ' + reason);

            logChannel.send(embed);
            logChannel.send(targetMember.toString());
            logInfo('roles', targetMember.user.tag + ' has been given the "' + role.name + '" role by ' + author.user.tag);

            if (roleString === 'Muted')
                targetMember.send('You have been muted').catch();

        })
        .catch((error) => channelLogInfo('error: ' + error, author));
}

// duration: milliseconds
function giveTempRole(roleString, targetMember, duration, giver) {

    const role = getRole(roleString);
    return targetMember.roles.add(role)
        .then(() => {
            const memberId = targetMember.user.id;
            let existentTempRolesString;
            let line;
            let data = fs.readFileSync(tempRolesFile, {encoding: 'utf-8'});
            data.split('\n').forEach(string => {
                if (string.startsWith('#')) return;
                line = string.split(': ');
                if (line[0] === memberId) {
                    existentTempRolesString = string;
                }
            });

            if (existentTempRolesString) {
                let tempRoleSplit;
                let done = false;

                existentTempRolesString.split(': ')[1].split('; ').forEach(tempRole => {
                    if (tempRole.length < 1) return;
                    tempRoleSplit = tempRole.split(', ');

                    if (tempRoleSplit[0] === roleString) {

                        data = data.replace(existentTempRolesString, existentTempRolesString.replace(tempRole, tempRoleSplit[0] + ', ' + (Date.now() + duration)));
                        done = true;
                    }
                });

                if (!done)
                    data = data.replace(existentTempRolesString, existentTempRolesString + roleString + ", " + (Date.now() + duration) + "; ");

            } else {
                data += "\n" + memberId + ": " + roleString + ", " + (Date.now() + duration) + "; ";
            }

            fs.writeFileSync(tempRolesFile, data);
        })
        .catch((error) => channelLogInfo('error: ' + error, giver));
}


//-----------OTHER

//[memberId]: [roleName1], [endDate]; [roleName2], [endDate]
function getTempRoles(memberId) {
    let data = fs.readFileSync(tempRolesFile);
    let line;
    let tempRoles;

    data.split('\n').forEach(string => {
        line = string.split(': ');
        if (line[0] === memberId) {
            let tempRolesStrings = line[1].split('; ');

            tempRolesStrings.forEach(tempRoleString => {
                tempRoleString.split(', ');
                tempRoles.push({role: tempRoleString[0], date: parseInt(tempRoleString[1])})
            });
        }
    });

    return tempRoles;
}

function debugLog(name, object) {
    console.log(name + ': ');

    if (object instanceof Array) {
        object.forEach(arg => {
            console.log('[' + arg + ']');
        });
    }

    console.log('');
}

function logInfo(topic, string) {
    console.log(getDateString() + ' [INFO]    [' + topic + '] ' + ' '.repeat(topicPrefixLength - topic.length) + string);
}

function logWarn(string) {
    console.log(getDateString() + ' [WARNING] ' + string);
}

function logDebug(topic, string) {
    console.log(getDateString() + ' [DEBUG]   [' + topic + '] ' + ' '.repeat(topicPrefixLength - topic.length) + string);
}

function getDateString() {
    const date = new Date();
    return date.getFullYear() + '-' +
        ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
        ('0' + date.getDate()).slice(-2) + '_' +
        ('0' + date.getHours()).slice(-2) + '-' +
        ('0' + date.getMinutes()).slice(-2) + '-' +
        ('0' + date.getSeconds()).slice(-2);
}

function getURLs(attachments) {
    let output = "";
    attachments.forEach(a => output += a.url + ' ');
    if (output === "") return "-";
    return output;
}

function isBadString(string) {
    return string.includes('@') || string.includes('<') || string.includes('>');
}

function nthIndex(str, pat, n) {
    let L = str.length, i = -1;
    while (n-- && i++ < L) {
        i = str.indexOf(pat, i);
        if (i < 0) break;
    }
    return i;
}