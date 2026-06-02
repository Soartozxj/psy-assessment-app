#!/usr/bin/env python3
import json

preQuestions = [
    {"id":"gender","type":"select","label":"性别","options":[{"value":"male","label":"男"},{"value":"female","label":"女"}],"required":True},
    {"id":"age","type":"text","label":"年龄","placeholder":"请输入年龄","required":True},
    {"id":"live_with_parents_to","type":"text","label":"你与父母一起生活到____岁","placeholder":"请输入年龄","required":False},
    {"id":"father_alive","type":"select","label":"父亲是否健在","options":[{"value":"yes","label":"是"},{"value":"no","label":"否","showExtra":"father_death_age"}],"required":True},
    {"id":"father_death_age","type":"text","label":"父亲在你____岁时去世","placeholder":"请输入年龄","showWhen":{"dependsOn":"father_alive","equals":"no"},"required":False},
    {"id":"mother_alive","type":"select","label":"母亲是否健在","options":[{"value":"yes","label":"是"},{"value":"no","label":"否","showExtra":"mother_death_age"}],"required":True},
    {"id":"mother_death_age","type":"text","label":"母亲在你____岁时去世","placeholder":"请输入年龄","showWhen":{"dependsOn":"mother_alive","equals":"no"},"required":False},
    {"id":"parents_divorced","type":"select","label":"父母是否离异","options":[{"value":"yes","label":"是","showExtra":"divorce_age"},{"value":"no","label":"否"}],"required":True},
    {"id":"divorce_age","type":"text","label":"在你____岁时离异","placeholder":"请输入年龄","showWhen":{"dependsOn":"parents_divorced","equals":"yes"},"required":False},
    {"id":"father_education","type":"select","label":"父亲文化程度","options":[{"value":"college","label":"大学(包括大学以上、大专)"},{"value":"highschool","label":"中专(包括高中)"},{"value":"middle","label":"初中"},{"value":"elementary","label":"小学"}],"required":True},
    {"id":"father_job","type":"select","label":"父亲职业","options":[{"value":"worker","label":"工人"},{"value":"farmer","label":"农民"},{"value":"intellectual","label":"知识分子"},{"value":"cadre","label":"干部"}],"required":True},
    {"id":"mother_education","type":"select","label":"母亲文化程度","options":[{"value":"college","label":"大学(包括大学以上、大专)"},{"value":"highschool","label":"中专(包括高中)"},{"value":"middle","label":"初中"},{"value":"elementary","label":"小学"}],"required":True},
    {"id":"mother_job","type":"select","label":"母亲职业","options":[{"value":"worker","label":"工人"},{"value":"farmer","label":"农民"},{"value":"intellectual","label":"知识分子"},{"value":"cadre","label":"干部"}],"required":True},
]

questions_text = [
    (1, "我觉得父母干涉我做的任何一件事", True, True),
    (2, "我能通过父母的言谈、表情感受到他们很喜欢我", True, True),
    (3, "与我的兄弟姐妹相比，父母更宠爱我", True, True),
    (4, "我能感受到父母对我的喜爱", True, True),
    (5, "即使是很小的过错，父亲也会惩罚我", True, False),
    (6, "父母总是试图潜移默化地影响我，使我成为出类拔萃的人", True, True),
    (7, "我觉得父母允许我在某些方面有独到之处", True, True),
    (8, "父母能让我得到其他兄弟姐妹得不到的东西", True, True),
    (9, "父母对我的惩罚是公平的", True, True),
    (10, "我觉得父亲对我很严厉", True, False),
    (11, "父母总是左右我应该穿什么衣服或打扮成什么样子", True, True),
    (12, "父母不允许我做一些其他孩子可以做的事情，因为他们害怕我会出事", True, True),
    (13, "在我小时候，父母曾经当着别人的面打我或训斥我", True, True),
    (14, "父母总是很关心我晚上做什么", True, True),
    (15, "当遇到不顺心的事时，我能感到父母在尽力鼓励我，使我得到安慰", True, True),
    (16, "父母总是过分担心我的健康", True, True),
    (17, "父母对我的惩罚往往超过了我能承受的程度", True, True),
    (18, "如果我在家里不听吩咐，父亲就会很恼火", True, False),
    (19, "如果我做错了什么事，母亲总是一副伤心的样子使我有负疚感", False, True),
    (20, "我觉得父亲难以接近", True, False),
    (21, "父亲曾在别人面前唠叨我说过的话或做过的事，这让我很难堪", True, False),
    (22, "我觉得父母更喜欢我，而不是我的兄弟姐妹", True, True),
    (23, "在满足我所需要的东西时，父母总是很小气", True, True),
    (24, "母亲常常很在乎我取得的分数", False, True),
    (25, "当我面临一项艰难的任务时，我能感受到来自父母的支持", True, True),
    (26, "我在家里往往被母亲当作替罪羊或害群之马", False, True),
    (27, "父母总是挑剔我所喜欢的朋友", True, True),
    (28, "父母总是认为他们的不快是由我引起的", True, True),
    (29, "父母总是试图鼓励我，使我成为佼佼者", True, True),
    (30, "父母总向我表示他们是爱我的", True, True),
    (31, "父母对我很信任，且允许我独自完成某些事", True, True),
    (32, "我觉得父母很尊重我的想法", True, True),
    (33, "我觉得父母很愿意跟我在一起", True, True),
    (34, "我觉得父母对我很小气、吝啬", True, True),
    (35, "父母总是向我说类似这样的话'如果你这样做我会很伤心'", True, True),
    (36, "父母要求我回到家里必须得向他们说明我在外面做了什么事情", True, True),
    (37, "我觉得父母在尽力使我的青春期更有意义和丰富多彩", True, True),
    (38, "母亲经常向我表述类似这样的话'这就是我们为你整日操劳而得到的报答吗'", False, True),
    (39, "父母常以不能娇惯我为借口而不满足我的要求", True, True),
    (40, "如果不按父亲所期望的去做，就会使我良心不安", True, False),
    (41, "我觉得母亲对我的学习成绩、体育活动或类似的事情有较高的要求", False, True),
    (42, "当我感到伤心的时候，我可以从父母那里得到安慰", True, True),
    (43, "父母曾无缘无故地惩罚我", True, True),
    (44, "父母允许我做一些我的朋友们可以做的事情", True, True),
    (45, "父母经常对我说他们不喜欢我在家里的表现", True, True),
    (46, "每当我吃饭时，母亲就劝我或强迫我再多吃一些", False, True),
    (47, "父亲经常当着别人的面批评我又懒惰又无用", True, False),
    (48, "父母常常关注我交往什么样的朋友", True, True),
    (49, "如果发生什么事情，我常常是母亲偏爱的兄弟姐妹中唯一受责备的一个", False, True),
    (50, "父母能让我顺其自然地发展", True, True),
    (51, "父母经常对我粗俗无礼", True, True),
    (52, "有时甚至为一点儿鸡毛蒜皮的小事，父母也会严厉地惩罚我", True, True),
    (53, "父母曾无缘无故地打过我", True, True),
    (54, "父亲通常会参与我的业余爱好活动", True, False),
    (55, "我经常挨母亲的打", False, True),
    (56, "父母常常允许我到我喜欢去的地方，而他们又不会过分担心", True, True),
    (57, "父母对我该做什么、不该做什么都有严格的限制而且绝不让步", True, True),
    (58, "父母常以一种使我很难堪的方式对待我", True, True),
    (59, "我觉得父母对我可能出事的担心是夸大的、过分的", True, True),
    (60, "我觉得与父母之间存在一种温暖、体贴和亲热的感觉", True, True),
    (61, "父母能容忍我与他们有不同的见解", True, True),
    (62, "父母常常在我不知道原因的情况下对我大发脾气", True, True),
    (63, "当我所做的事取得成功时，我觉得父亲很为我自豪", True, False),
    (64, "与我的兄弟姐妹相比，母亲常常偏爱我", False, True),
    (65, "有时即使错误在我，父母也把责任归咎于兄弟姐妹", True, True),
    (66, "父母经常拥抱我", True, True),
]

r_options = [
    {"label": "从不", "score": 1},
    {"label": "有时", "score": 2},
    {"label": "经常", "score": 3},
    {"label": "总是", "score": 4},
]

questions = []
for qid, text, has_father, has_mother in questions_text:
    main_options = []
    if has_father:
        main_options.append({"label": "父亲", "score": 0, "hasChildren": True})
    if has_mother:
        main_options.append({"label": "母亲", "score": 0, "hasChildren": True})
    main_options.append({"label": "不适用(独生子女/父母不全)", "score": 0, "isTerminal": True})
    questions.append({
        "id": qid,
        "content": text,
        "type": "parent-child",
        "options": main_options,
        "subOptions": r_options,
    })

scale = {
    "name": "父母教养方式评价量表(EMBU)",
    "shortName": "EMBU",
    "code": "EMBU",
    "category": "bond",
    "categoryName": "家庭与人际关系量表",
    "emoji": "\U0001F468\u200D\U0001F469\u200D\U0001F467",
    "color": "#e2e52e",
    "duration": 25,
    "questionTime": 30,
    "questionCount": len(questions),
    "applicablePeople": "成人（回忆童年期父母教养方式）",
    "desc": "父母教养方式评价量表(EMBU)由瑞典Umea大学Perris等1980年编制，1993年岳冬梅等修订中文版。共66题（含父/母分题），采用4级评分（从不=1至总是=4）。用于评估个体童年期感知到的父母教养行为，涵盖情感温暖、惩罚严厉、过分干涉、偏爱、拒绝否认、过度保护等维度。",
    "instruction": "父母的教养方式对子女的发展和成长是至关重要的。虽然让你确切回忆小时候父母对你说教的每一个细节是很困难的，但每个人都对成长过程中父母对待我们的方式有深刻印象。回答这一问卷，就是请你努力回想小时候留下的这些印象。每题请分别在最符合你父亲和母亲的等级上作答。如果你小时候父母不全，可以只回答父亲或母亲一栏。如果你是独生子女，相关的题目可以不作答。",
    "notice": [
        "请根据童年回忆如实作答",
        "每题需分别评价父亲和母亲（如适用）",
        "如父母不全或为独生子女，相应题目可选「不适用」",
        "答案无对错之分，问卷不记名",
    ],
    "tags": ["家庭", "教养方式", "EMBU", "亲子关系"],
    "status": 2,
    "sortOrder": 100,
    "rating": 4.5,
    "npcConfig": {"counselorId": "", "backgroundId": ""},
    "preQuestions": preQuestions,
    "questions": questions,
}

# Write import file
with open("/Users/rich/WorkBuddy/20260407113106/EMBU_scales_import.json", "w", encoding="utf-8") as f:
    json.dump([scale], f, ensure_ascii=False, indent=2)

print(f"Done: {len(preQuestions)} preQuestions + {len(questions)} questions")
father_only = sum(1 for _, _, f, m in questions_text if f and not m)
mother_only = sum(1 for _, _, f, m in questions_text if not f and m)
both = sum(1 for _, _, f, m in questions_text if f and m)
print(f"Father-only: {father_only}, Mother-only: {mother_only}, Both: {both}")
