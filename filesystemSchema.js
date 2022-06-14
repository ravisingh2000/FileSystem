//Sqlite Schema Library
const sqlite3 = require("sqlite3").verbose()

//Data base credets
// name of database:FileSystem
// name of table:filesystem
const db = new sqlite3.Database("./FileSystem.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
    console.log("connection sucessfull")
})

//Here I use filepath to check whether file exist or not we can also use forloop to check path exit or not
// for that i use this table schema
function createTable() {
    db.run("CREATE TABLE filesystem(DirectoryIndex INTEGER ,Parent_directory INTEGER,Name TEXT UNIQUE,Content TEXT,Type TEXT,Filepath TEXT,DateCreated TEXT,DateModified TEXT)")
}

//Wrap the query with promise
function select(newquery) {
    return new Promise((resolve, reject) => {
        const queries = [];
        db.all(newquery, (err, n) => {
            if (err) {
                reject(err);
            } else {
                resolve(n); // resolve the promise
            }
        });
    });
}

async function create(path, type) {
    let finalpath = path.split("/");
    // console.log(finalpath);
    const newElement = finalpath[finalpath.length - 1]
    finalpath = path.replace(('/' + newElement), '')
    let content;
    // console.log(finalpath, path, type, newElement);
    let parentDirectory = 0;
    if (finalpath != '') {
        const checkPathExist = await select(`SELECT * FROM filesystem where FilePath='${finalpath}'  `)
        if (checkPathExist.length <= 0) {
            return false;
        }
        else {
            parentDirectory = checkPathExist[0].DirectoryIndex
        }
    }
    console.log(parentDirectory);
    const checkNewElementExist = await select(`SELECT * FROM filesystem where FilePath='${path}'  `)
    if (checkNewElementExist.length > 0) {
        return false;
    }
    let rowCount = await select(`SELECT COUNT(*) FROM filesystem`)
    if (type == 'file') content = "file fresh content "; else null
    const createdDate = new Date(Date.now()).toISOString()
    db.run(`INSERT INTO filesystem(DirectoryIndex, Parent_directory, Name,Content,Type,FilePath,DateCreated)VALUES(?,?,?,?,?,?,?)`, [rowCount[0]['COUNT(*)'] + 1, parentDirectory, newElement, content, type, path, createdDate], (err) => {
        if (err) return console.error(err.message);
        console.log("data is inserted")
    })
}

async function Scan(dir_path) {
    //here I check all sub elments of that
    let elements = await select(`SELECT * FROM filesystem WHERE Parent_directory=(SELECT DirectoryIndex FROM filesystem WHERE FilePath='${dir_path}')`)
    if (elements.length > 0) {
        elements = elements.map((value) => {
            return value.Name;
        })
    }
    console.log(elements);
    return elements;
}

async function read(file_path) {

    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    if (filecontent.length == 0 || filecontent[0].Type == 'folder') {
        return null;
    }
    console.log(filecontent);
    return filecontent[0].Content
}
async function write(file_path, string_content) {
    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    console.log('FF');
    console.log(filecontent);
    if (filecontent.length == 0 || filecontent[0].Type == 'folder') {
        return false;
    }
    const updatedDate = new Date(Date.now()).toISOString()
    let updatecontent = db.run(`UPDATE filesystem SET Content = '${string_content}', DateModified= '${updatedDate}' WHERE FilePath='${file_path}' `, (err) => {
        if (err) return console.error(err.message);
        console.log("CONTENT IS UPDATED")
    })

    return true;
}
async function rename(elm_path, new_name) {
    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${elm_path}'`)
    console.log(filecontent);
    if (filecontent.length == 0 || filecontent[0].Type == 'folder') {
        return false;
    }
    const updatedDate = new Date(Date.now()).toISOString()
    let updatecontent = db.run(`UPDATE filesystem SET Name = '${new_name}', DateModified= '${updatedDate}' WHERE FilePath='${elm_path}' `, (err) => {
        if (err) return console.error(err.message);
        console.log("NAME IS UPDATED")
    })

    return true;
}

async function mtime(file_path) {

    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    if (filecontent.length == 0) {
        return -1;
    }
    console.log(filecontent);
    var date = new Date(filecontent[0].DateModified);
    var unixTimeStamp = Math.floor(date.getTime() / 1000);
    console.log(unixTimeStamp);
    return unixTimeStamp
}
async function ctime(file_path) {

    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    if (filecontent.length == 0) {
        return -1;
    }
    console.log(filecontent);
    var date = new Date(filecontent[0].DateCreated);
    var unixTimeStamp = Math.floor(date.getTime() / 1000);
    console.log(unixTimeStamp);
    return unixTimeStamp
}
// console.log(mtime('/mn/gg/ll/jj/ddd.txt'));
async function deleteElement(elem_path) {
    // for (let path in fulllpath) {
    // message = await select(`SELECT * FROM  filesystem WHERE Name=${path};`))
    // let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${elem_path}'`)
    const checkNewElementExist = await select(`SELECT * FROM filesystem where FilePath='${elem_path}'  `)
    console.log(checkNewElementExist);
    if (checkNewElementExist.length == 0) {
        console.log('Delete element NOT exist');
        return false;
    }

    if (checkNewElementExist[0].Type == 'file') {
        db.run(`DELETE FROM filesystem WHERE  DirectoryIndex=${checkNewElementExist[0].DirectoryIndex}; `, (err) => {
            if (err) return console.error(err.message);
            console.log("File Deleted sucessfully");
        })
        return true;
    }

    else {

        //recursive query then i use for that
        let deletedElements = await select(`WITH virtualDeleteTable(DirectoryIndex, Name,Parent_directory)  AS(
            SELECT i.DirectoryIndex,i.Name,i.Parent_directory From filesystem i where   i.DirectoryIndex=${checkNewElementExist[0].DirectoryIndex}
            UNION ALL
            SELECT i.DirectoryIndex,i.Name,i.Parent_directory FROM  filesystem i Join virtualDeleteTable j
            ON j.DirectoryIndex=i.Parent_directory)
            SELECT * FROM virtualDeleteTable;`)
        if (deletedElements.length == 0) {
            return false;
        }
        console.log(deletedElements);
        for (let deletedIndexed in deletedElements) {
            console.log(deletedIndexed);
            db.run(`DELETE FROM filesystem WHERE  DirectoryIndex=${deletedElements[deletedIndexed].DirectoryIndex} `, (err) => {
                if (err) return console.error(err.message);
                console.log("Folder Deleted sucessfully");
            })
        }
        return true;

    }
}

async function move(elm_path, dir_path) {
    let currentpath = elm_path.split("/")
    let moveElement = currentpath.pop()
    currentpath = currentpath.join('/')
    console.log(dir_path.includes(currentpath));
    if (dir_path.includes(currentpath)) {
        return true;
    }
    console.log(elm_path);
    const checkOldPath = await select(`SELECT * FROM filesystem where FilePath='${elm_path}'  `)
    console.log(checkOldPath);
    const newPath = await select(`SELECT * FROM filesystem where FilePath='${dir_path}'  `)
    console.log("jj");
    console.log(newPath);
    let newfilePath = dir_path + '/' + moveElement;
    db.run(`UPDATE filesystem SET  Parent_directory=${newPath[0].DirectoryIndex},FilePath='${newfilePath}', DateModified = '${newPath[0].DateModified}' WHERE DirectoryIndex = ${checkOldPath[0].DirectoryIndex} `, (err) => {
        if (err) return console.error(err.message);
        console.log("CONTENT2 IS UPDATED")
    })
    return true;

}
async function tableData() {
    try {
        const selectsql = 'SELECT * FROM  filesystem;'
        let message = await select(selectsql)
        console.log(message);
    }
    catch (error) {
        console.log(error);
    }
}
//All function for filesystem Schema
// createTable()
// deleteElement("/ravi")
create('/pnb', 'folder')
// ctime('/yesbank/mean.txt')
// mtime('/mn/gg/ll/jj/ddd.txt', 'newSone')
// Scan('/ravi')
// write('/mn/gg/ll/jj/ddd.txt', 'newSone')
// rename('/pnb/mean.txt', 'newSone.txt')
// move('/ui/mean.txt', '/ravi')
// read('/jj');
tableData()



// db.close((err) => {
//     if (err) return console.error(err.message);
// })
